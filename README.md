# Show Whitespace in Brackets

[Brackets](http://brackets.io/) extension to visualize whitespace (spaces and tabs) like [Sublime Text](http://www.sublimetext.com/) does. Adds an entry called "Show Whitespace" to the View menu, the shortcut is Command-Shift-W (or Ctrl-Shift-W on Windows). The state is remembered next time you start Brackets.

This extension overwrites `Line.getHTML` (part of [CodeMirror](http://codemirror.net/)) and modifies its output. Spaces in the indentation are wrapped as `<span class="cm-space dk-leading"> </span>`, normal spaces as `<span class="cm-space dk-normal"> </span>`. CodeMirror itself already handles tabs similarly, this extension turns those into `<span class="cm-tab dk-leading"> </span>` if they are part of the whitespace starting a line and `<span class="cm-tab dk-normal"> </span>` otherwise.

The styles are defined in `main.less` which is compiled to CSS and loaded into Brackets when loading the extension.

Whitespace in inline editors is visualized as well.


## Install

Open Brackets and click Help > Show Extensions Folder
Clone the extension into the user subdirectory:

    git clone git://github.com/DennisKehrig/brackets-show-whitespace.git user/ShowWhitespace


## Changelog

### 2012-11-14

Changed the name to "Show Whitespace" as all whitespace is visualized now.

### 2012-06-29

Instead of adding a separate `<div>` with an entry for the indentation of each line, the HTML code that CodeMirror itself produces is augmented. This makes the extension much more reliable and faster. Support for inline editors then is gratis, too - except for refresh calls when the setting is toggled.


## Brackets Wishlist

What I wish Brackets would provide:

- An API to remove a command
- An API to remove a menu item


## License

The MIT License (MIT)
Copyright (c) 2012 Dennis Kehrig. All rights reserved.
 
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
