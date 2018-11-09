import re
def format_template(filename):
    with open(filename) as f:
        lines = f.readlines()
    ending_left_old = "<%= /"
    left_old = "<%= #"
    left_new = "<%_ "
    newlines = []
    in_loop = False
    var_names = []
    for l in lines:
        if l.find(ending_left_old) > -1:
            assert var_names[-1] == l.split(ending_left_old)[1].split(" ")[0].replace("current_page.", "")
            l = re.sub(r"<%=\s*\/([-_\/\.\w]+)\s*%>", "<%_ }); -%>", l)
            var_names = var_names[:-1]
            in_loop = False
        if l.find(left_old) > -1:
            var_name = l.split(left_old)[1].split(" ")[0].replace("current_page.", "")
            right_old = var_name + " %>"
            right_new = var_name + ".forEach(function({}".format(var_name[:-1]) + ", i, arr){ -%>"
            l = l.replace(left_old, left_new)
            l = l.replace(right_old, right_new)
            print(var_name)
            var_names.append(var_name)
            in_loop = True
            if len(var_names):
                l = l.replace(var_name, ".".join(var_names))
        if l.find("<%= ") > -1:
            #re.replace(r"<%= [\w] %>", l, "<%=
            def replace(matchobj):
                subv = matchobj.group(1)
                if len(var_names):
                    if in_loop:
                        subv = var_names[-1][:-1] + "." + subv
                    else:
                        subv = ".".join(var_names + [subv])
                return "<%= " + subv + " %>"
            l = re.sub(r"<%=\s*([-_\/\.\w]+)\s*%>", replace, l)

        newlines.append(l)
    template = ''.join(newlines)
    with open(filename, 'w') as f:
        f.write(template)
if __name__ == '__main__':
    for d in os.listdir("content"):
        subd = os.path.join("content", d)
        if os.path.isdir(subd):
            files = [os.path.join(subd, f) for f in os.listdir(subd)]
            if len(files) == 1 and files[0].endswith("index.ejs"):
                format_template(files[0])

