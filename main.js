/*
 * The MIT License (MIT)
 * Copyright (c) 2012 Dennis Kehrig. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a
 * copy of this software and associated documentation files (the "Software"),
 * to deal in the Software without restriction, including without limitation
 * the rights to use, copy, modify, merge, publish, distribute, sublicense,
 * and/or sell copies of the Software, and to permit persons to whom the
 * Software is furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in
 * all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING
 * FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER
 * DEALINGS IN THE SOFTWARE.
 *
 */

/*jslint vars: true, plusplus: true, devel: true, regexp: true, nomen: true, indent: 4, maxerr: 50 */
/*global define, $, brackets, Node, CodeMirror */

define(function (require, exports, module) {
    "use strict";
    
    
    // --- Required modules ---

    var CommandManager     = brackets.getModule("command/CommandManager");
    var DocumentManager    = brackets.getModule("document/DocumentManager");
    var EditorManager      = brackets.getModule("editor/EditorManager");
    var ExtensionUtils     = brackets.getModule("utils/ExtensionUtils");
    var Menus              = brackets.getModule("command/Menus");
    var PreferencesManager = brackets.getModule("preferences/PreferencesManager");

    
    // --- Settings ---
    
    var commandId          = "denniskehrig.ShowWhitespace.toggle";
    var preferencesId      = "denniskehrig.ShowWhitespace";
    var defaultPreferences = { checked: false };

    
    // --- State Variables ---
    
    var _preferences;
    var _command;
    var _styleTag;
    
    var _appendSpace = false;
    
    
    // --- Functionality ---

    var overlay = {
        token: function (stream, state) {
            var ch,
                ateCode = false;
            
            // Boolean makes JSLint happy
            while (Boolean(ch = stream.peek())) {
                if (ch === " " || ch === "\t") {
                    if (ateCode) {
                        // Return now to mark all code seen so far as not necessary to highlight
                        return null;
                    }
                    // Eat the whitespace
                    stream.next();
                    // CodeMirror merges consecutive tokens with the same style
                    // To prevent that we simply add a space to the style every other time
                    // This disables CodeMirror's string comparison while having no effect on the CSS class
                    _appendSpace = !_appendSpace;
                    return "dk-whitespace-" + (ch === " " ? "space" : "tab") + (_appendSpace ? " " : "");
                } else {
                    stream.next();
                    ateCode = true;
                }
            }
            return null;
        }
    };
        
    function refreshCodeMirror() {
        var fullEditor = EditorManager.getCurrentFullEditor();
        if (!fullEditor || !fullEditor._codeMirror) { return; }

        fullEditor._codeMirror.removeOverlay(overlay);
        if (_command.getChecked()) {
            fullEditor._codeMirror.addOverlay(overlay);
        }
    }

    // --- Event Handlers ---

    function onCommandExecuted() {
        if (!_command.getChecked()) {
            _command.setChecked(true);
        } else {
            _command.setChecked(false);
        }
    }

    function onCheckedStateChange() {
        _preferences.setValue("checked", Boolean(_command.getChecked()));
        refreshCodeMirror();
    }

    // --- Loaders and Unloaders ---

    function loadPreferences() {
        _preferences = PreferencesManager.getPreferenceStorage(preferencesId, defaultPreferences);
    }


    function loadStyle() {
        ExtensionUtils.loadStyleSheet(module, "main.less").done(function (node) {
            _styleTag = node;
        });
    }

    function unloadStyle() {
        $(_styleTag).remove();
    }

    
    function loadCommand() {
        _command = CommandManager.get(commandId);
        
        if (!_command) {
            _command = CommandManager.register("Show Whitespace", commandId, onCommandExecuted);
        } else {
            _command._commandFn = onCommandExecuted;
        }

        $(_command).on("checkedStateChange", onCheckedStateChange);
        
        // Apply preferences
        _command.setChecked(_preferences.getValue("checked"));
    }

    function unloadCommand() {
        _command.setChecked(false);
        $(_command).off("checkedStateChange", onCheckedStateChange);
        _command._commandFn = null;
    }

    
    function loadMenuItem() {
        Menus.getMenu("view-menu").addMenuItem(commandId, "Ctrl-Alt-W");
    }

    function unloadMenuItem() {
        Menus.getMenu("view-menu").removeMenuItem(commandId);
    }
    
    
    function loadDocumentSync() {
        $(DocumentManager).on("currentDocumentChange", refreshCodeMirror);
    }

    function unloadDocumentSync() {
        $(DocumentManager).off("currentDocumentChange", refreshCodeMirror);
    }

    
    // Setup the UI
    function load() {
        loadPreferences();
        loadStyle();
        loadCommand();
        loadMenuItem();
        loadDocumentSync();
    }

    // Tear down the UI
    function unload() {
        unloadDocumentSync();
        unloadMenuItem();
        unloadCommand();
        unloadStyle();
    }


    // --- Exports ---
    
    exports.load = load;
    exports.unload = unload;

    
    // --- Initializiation ---
    
    load();
});