# coding: utf-8

Gem::Specification.new do |spec|
  spec.name          = "ben-blog-theme"
  spec.version       = "0.1.0"
  spec.authors       = ["bschreck"]
  spec.email         = ["bschreck@mit.edu"]

  spec.summary       = %q{Base theme for my personal website and blog}
  spec.homepage      = "https://github.com/bschreck/bschreck.github.io"
  spec.license       = "MIT"

  spec.files         = `git ls-files -z`.split("\x0").select { |f| f.match(%r{^(assets|_layouts|_includes|_sass|LICENSE|README)}i) }

  spec.add_development_dependency "jekyll", "~> 3.3"
  spec.add_development_dependency "bundler", "~> 1.12"
  spec.add_development_dependency "rake", "~> 10.0"
end
