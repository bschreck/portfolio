#!/usr/bin/env node

"use strict";

var showdown  = require('showdown');
var fs = require("fs");
var http = require("http");
var path = require("path");
var process = require("process");
var ejs = require("ejs");
var path = require("path");
var less = require('less');

var entityMap = {
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;", "/": "&#x2F;", "`": "&#x60;", "=": "&#x3D;"
};

function escapeHtml(text) {
    return text.replace(/[&<>"'`=\/]/g, function (char) {
        return entityMap[char];
    });
}

function merge() {
    var target = {};
    for (var i = 0; i < arguments.length; i++) {
        target = Object.assign(target, arguments[i]);
    }
    return target;
}

function formatDate(date, format) {
    switch (format) {
        case "atom":
            return date.toISOString().replace(/\.[0-9]*Z/, "Z");
        case "rss":
            return date.toUTCString().replace(" GMT", " +0000");
        case "user":
            var months = [ "Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" ];
            return months[date.getMonth()] + " " + date.getDate() + ", " + date.getFullYear();
    }
    return "";
}

var truncateMap = { "pre": true, "code": true, "img": true, "table": true, "style": true, "script": true, "h2": true, "h3": true };

function truncate(text, length) {
    var closeTags = {};
    var ellipsis = "";
    var count = 0;
    var index = 0;
    while (count < length && index < text.length) {
        if (text[index] == '<') {
            if (index in closeTags) {
                var closeTagLength = closeTags[index].length;
                delete closeTags[index];
                index += closeTagLength;
            }
            else {
                var match = text.substring(index).match("<(\\w+)[^>]*>");
                if (match) {
                    var tag = match[1].toLowerCase();
                    if (tag in truncateMap) {
                        break;
                    }
                    index += match[0].length;
                    var closeTagRegExp = new RegExp("(</" + tag + "\\s*>)", "i");
                    var end = text.substring(index).search(closeTagRegExp);
                    if (end != -1) {
                        closeTags[index + end] = "</" + tag + ">";
                    }
                }
                else {
                    index++;
                    count++;
                }
            }
        }
        else if (text[index] == "&") {
            index++;
            var entity = text.substring(index).match("(#?[A-Za-z0-9]+;)");
            if (entity) {
                index += entity[0].length;
            }
            count++;
        }
        else {
            if (text[index] == " ") {
                index++;
                count++;
            }
            var skip = text.substring(index).search(" |<|&");
            if (skip == -1) {
                skip = text.length - index;
            }
            if (count + skip > length) {
                ellipsis = "&hellip;";
            }
            if (count + skip - 15 > length) {
                skip = length - count;
            }
            index += skip;
            count += skip;
        }
    }
    var output = [ text.substring(0, index) ];
    if (ellipsis !== "") {
        output.push(ellipsis);
    }
    var keys = [];
    for (var key in closeTags) {
        keys.push(Number(key));
    }
    keys.sort().forEach(function (key) {
        output.push(closeTags[key]);
    });
    return output.join("");
}

function loadPost(file) {
    if (fs.existsSync(file) && !fs.statSync(file).isDirectory()) {
        var data = fs.readFileSync(file, "utf-8");
        if (data) {
            var item = {"redirect_url": null};
            var content = [];
            var metadata = -1;
            var lines = data.split(/\r\n?|\n/g);
            while (lines.length > 0) {
                var line = lines.shift();
                if (line.startsWith("---")) {
                    metadata++;
                }
                else if (metadata === 0) {
                    var index = line.indexOf(":");
                    if (index >= 0) {
                        var name = line.slice(0, index).trim();
                        var value = line.slice(index + 1).trim();
                        if (value.startsWith('"') && value.endsWith('"')) {
                            value = value.slice(1, -1);
                        }
                        item[name] = value;
                    }
                }
                else {
                    content.push(line);
                }
            }
            var converter = new showdown.Converter();
            item["content"] = converter.makeHtml(content.join("\n"));

            return item;
        }
    }
    return null;
}

function posts() {
    return fs.readdirSync("content/blog/").filter(post => fs.statSync("content/blog/" + post).isDirectory() && fs.existsSync("content/blog/" + post + "/index.md")).sort().reverse();
}

function renderBlog(folders, root, page) {
    var view = { "items": [],
                 "template_path": configuration["template_path"],
                 "css_path": "../../site.css"}
    var count = 10;
    while (count > 0 && folders.length > 0) {
        var folder = folders.shift();

        var item = loadPost("content/blog/" + folder + "/index.md");
        if (item && (item["state"] === "post" || environment !== "production")) {
            item["url"] = item["redirect_url"] || folder + "/";
            if ("date" in item) {
                var date = new Date(item["date"].split(/ \+| \-/)[0] + "Z");
                item["date"] = formatDate(date, "user");
            }
            var content = item["content"];
            var truncated = content.split("<!more>")[0];
            //var truncated = truncate(content, 250);
            item["content"] = truncated;
            //item["more"] = truncated != content;
            view["items"].push(item);
            count--;
        }
    }
    view["placeholder"] = [];
    if (folders.length > 0) {
        page++;
        var location = "blog/page" + page.toString() + ".html";
        view["placeholder"].push({ "url": "/" + location });
        var destination = root + "/" + location;
        var data = renderBlog(folders, root, page);
        fs.writeFileSync(destination, data);
    }
    var template = fs.readFileSync(view["template_path"] + "feed.ejs", "utf-8");
    var options = {}
    return ejs.render(template, view, options);
}

function renderFeed(source, destination) {
    var host = configuration["host"];
    var format = path.extname(source).replace(".", "")
    var url = host + "/blog/feed." + format;
    var count = 10;
    var feed = {
        "name": configuration["name"],
        "description": configuration["description"],
        "author": configuration["name"],
        "host": host,
        "url": url,
        "items": [],
        "template_path": configuration["template_path"],
        "css_path": "../site.css"
    };
    var folders = posts();
    var recentFound = false;
    var recent = new Date();
    while (folders.length > 0 && count > 0) {
        var folder = folders.shift();
        var item = loadPost("content/blog/" + folder + "/index.md");
        if (item && (item["state"] === "post" || environment !== "production")) {
            item["url"] = host + "/blog/" + folder + "/";
            if (!item["author"] || item["author"] === configuration["name"]) {
                item["author"] = false;
            }
            if ("date" in item) {
                var date = new Date(item["date"]);
                var updated = date;
                if ("updated" in item) {
                    updated = new Date(item["updated"]);
                }
                item["date"] = formatDate(date, format);
                item["updated"] = formatDate(updated, format);
                if (!recentFound || recent < updated) {
                    recent = updated;
                    recentFound = true;
                }
            }
            item["content"] = escapeHtml(truncate(item["content"], 10000));
            //item["content"] = truncate(item["content"], 10000);
            feed["items"].push(item);
            count--;
        }
    }
    feed["updated"] = formatDate(recent, format);
    var options = {}
    ejs.renderFile(source, feed, options, function(err, str){
        fs.writeFileSync(destination, str);
    });
}

function renderPost(source, destination) {
    if (source.startsWith("content/blog/") && source.endsWith("/index.md")) {
        var item = loadPost(source);
        if (item) {
            if ("date" in item) {
                var date = new Date(item["date"].split(/ \+| \-/)[0] + "Z");
                item["date"] = formatDate(date, "user");
            }
            item["author"] = item["author"] || configuration["name"];
            var view = merge(configuration, item);

            var options = {}
            ejs.renderFile(view["template_path"] + "post.ejs", view, options, function(err, str){
                if (err) {
                  throw err;
                }
                fs.writeFileSync(destination.replace(".md", ".html"), str);
            });
            return true;
        }
    }
    return false;
}

function renderPage(source, destination, from_outline) {
    if (renderPost(source, destination)) {
        return;
    }
    var view = merge(configuration);

    view["blog"] = renderBlog(posts(), path.dirname(destination), 0)
    /* view["blog"] += `<script type='text/javascript'>
function updateStream() {
    var element = document.getElementById("stream");
    if (element) {
      var rect = element.getBoundingClientRect();
      var threshold = 0;
      if (rect.bottom > threshold && (window.innerHeight - rect.top) > threshold) {
        var url = element.getAttribute("title");
        var xmlHttp = new XMLHttpRequest();
        xmlHttp.open("GET", url, true);
        xmlHttp.onreadystatechange = function () {
            if (xmlHttp.readyState == 4 && xmlHttp.status == 200) {
                element.insertAdjacentHTML('beforebegin', xmlHttp.responseText);
                element.parentNode.removeChild(element);
                updateStream();
            }
        };
        xmlHttp.send(null);
      }
    }
}
updateStream();
window.addEventListener('scroll', function(e) {
    updateStream();
});
</script>
`*/
    if (source == "content/index.ejs") {
      var first_page = source.replace("/index.ejs", configuration["pages"][0]["url"] + "/index.ejs")
      return renderPage(first_page, destination, from_outline)
    }
    view["pages"] = [];
    configuration["pages"].forEach(function (page) {
        var active = ("content" + page["url"]).replace(/\/$/, "") == path.dirname(source)
        if (active) {
          view["current_page"] = page;
        }
        if (active || page["visible"]) {
            view["pages"].push({ "name": page["name"], "url": page["url"], "active": active});
        }
    });
    var options = {}
    var template = fs.readFileSync(source, "utf-8");
    var subpage = ejs.render(template, view, options);
    if (from_outline) {
      if (destination.split("/").length > 3) {
        view["css_path"] = "../site.css"
      }
      view["current_page"] = subpage
      ejs.renderFile(configuration["template_path"] + "page_outline.ejs", view, options, function(err, str){
          if (err) {
            console.log(err);
            throw err;
          }
          fs.writeFileSync(destination, str);
      });
    } else {
      fs.writeFileSync(destination, subpage);
    }
}

function renderFile(source, destination) {
    fs.createReadStream(source).pipe(fs.createWriteStream(destination));
}

function render(source, destination) {
    var extension = path.extname(source);
    switch (extension) {
        case ".rss":
        case ".atom":
            renderFeed(source, destination);
            break;
        case ".md":
            renderPage(source, destination.replace(".md", ".html"),
                       false);
            break;
        case ".ejs":
            renderPage(source, destination.replace(".ejs", ".html"),
                       !source.endsWith("404.ejs"));
            break;
        default:
            renderFile(source, destination);
            break;
    }
}

function makeDirectory(directory) {
    directory.split("/").reduce((current, folder) => {
        current += folder + "/";
        if (!fs.existsSync(current)) {
            fs.mkdirSync(current);
        }
        return current;
    }, '');
}
function renderDirectory(source, destination) {
    makeDirectory(destination);
    fs.readdirSync(source).forEach(function(item) {
        if (!item.startsWith(".")) {
            if (fs.statSync(source + item).isDirectory()) {
                renderDirectory(source + item + "/", destination + item + "/");
            }
            else {
                render(source + item, destination + item);
            }
        }
    });
}

function cleanDirectory(directory) {
    if (fs.existsSync(directory) && fs.statSync(directory).isDirectory()) {
        fs.readdirSync(directory).forEach(function (item, index) {
            item = directory + "/" + item;
            if (fs.statSync(item).isDirectory()) {
                cleanDirectory(item)
                fs.rmdirSync(item);
            }
            else {
                fs.unlinkSync(item);
            }
        });
    }
}
function renderLess(source, destination) {
  var less_str = fs.readFileSync(source, "utf-8");
  less.render(less_str, function (e, css) {
    if (e) {
      console.log(e);
    }
    fs.writeFileSync(destination, css['css']);
  });
}

var environment = process.env["ENVIRONMENT"];
console.log("node " + process.version + " " + environment);
var configuration = JSON.parse(fs.readFileSync("content.json", "utf-8"));
var destination = "build";
var theme = "default";
configuration["template_path"] = path.resolve("./themes/" + theme)  + "/";
configuration["css_path"] = "site.css"
var args = process.argv.slice(2);
while (args.length > 0) {
    var arg = args.shift();
    if (arg == "--theme" && args.length > 0) {
        theme = args.shift();
    }
    else {
        destination = arg;
    }
}
cleanDirectory(destination);
var destination_css_file = destination + "/site.css";
destination_css_file = path.resolve(destination_css_file);
var current_dir = process.cwd();
process.chdir(configuration["template_path"]);
renderLess("site.less", destination_css_file);
process.chdir(current_dir);
renderDirectory("content/", destination + "/");
