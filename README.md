# Show Indentations in Brackets

Brackets extension to visualize indentations (spaces and tabs at the beginning of lines) like Sublime Text does. Adds an entry called "Show Indentations" to the View menu, shortcut is Command-Shift-W (or Ctrl-Shift-W on Windows). The state is remembered next time you start Brackets.

In the end this is a dirty hack that might break with changes around CodeMirror.
Might make editing long files slow.


## Install

Clone the extension into the disabled extensions folder of Brackets:

    git clone git://github.com/DennisKehrig/brackets-show-indentations.git brackets/src/extensions/disabled/ShowIndentations

Create a link to enable the extension:

    ln -s ../disabled/ShowIndentations brackets/src/extensions/user/ShowIndentations


## Brackets Wishlist

What I wish Brackets would provide:

- An API to remove a command
- An API to get the tab width
- An API to react to changes in lines (removed, added, modified)
- An API to decorate a line with actual DOM nodes, not just CSS classes


## Todo

- Show indentations in inline editors
- Optimize to only update indentations for lines that changed


## License

The MIT License (MIT)
Copyright (c) 2012 Dennis Kehrig. All rights reserved.
 
Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:
 
The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.
 
THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
