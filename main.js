/*
 * Copyright (c) 2013 Albert Xing.
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
 */

/*jslint vars: true, plusplus: true, devel: true, nomen: true, regexp: true, indent: 4, maxerr: 50 */
/*global define, brackets, window, $, document */

var KeyBindingManager   = brackets.getModule("command/KeyBindingManager"),
    CommandManager      = brackets.getModule("command/CommandManager"),
    Commands            = brackets.getModule("command/Commands"),
    Menus               = brackets.getModule("command/Menus"),
    FileViewController  = brackets.getModule("project/FileViewController"),
    SidebarView         = brackets.getModule("project/SidebarView"),
    DocumentManager     = brackets.getModule("document/DocumentManager"),
    EditorManager       = brackets.getModule("editor/EditorManager"),
    ViewUtils           = brackets.getModule("utils/ViewUtils"),
    Resizer             = brackets.getModule("utils/Resizer"),
    Strings             = brackets.getModule("strings");

define(function (require, exports, module) {
    
    "use strict";
    
    var _FILE_KEY = "file",
        $openFilesContainer = $("#open-files-container"),
        $openFilesList = $("#open-files-container").find("ul"),
        tabsVisible;
    
    var link = require.toUrl("./style" + (($("#main-toolbar").width() === 30) ? "" : "-pre") + ".css");
    var style = document.createElement("link");
    style.type = "text/css";
    style.rel = "stylesheet";
    style.href = link;
    document.querySelector("head").appendChild(style);
    
    /**
	 * Resizes tabs if not enough room
	 */
    function squeeze() {
        if ($openFilesList.find("li").length * 100 > $openFilesContainer.width() || $openFilesList.width() > $openFilesContainer.width()) {
            $openFilesList.find("li").css("width", ($openFilesContainer.width() - $(".buttons").width() - 20) / $openFilesList.find("li").length);
        } else {
            $openFilesList.find("li").css("width", "auto");
            if ($openFilesList.width() > $openFilesContainer.width()) {
                squeeze();
            }
        }
    }
    
    /**
	 * Show tabs & hide sidebar
	 */
    function showTabs() {
        // Move the open file container to the main parent
        $("#open-files-container").insertBefore("#editor-holder");
        // Hide the open file pointer triangle
        $(".sidebar-selection-triangle").hide();
        // Add class .tabs to toolbar - activates styles
        $(".content").addClass("tabs");
        // Make sure the tabs fit inside the window
        $("#open-files-container").find("ul").bind("DOMSubtreeModified", squeeze);
        $(window).bind("resize", squeeze);
        tabsVisible = true;
    }
    
    /**
	 * Hide tabs & show sidebar
	 */
    function hideTabs() {
        // Move back into sidebar
        $("#open-files-container").prependTo("#file-section");
        // Show selection triangle
        $(".sidebar-selection-triangle").css("display", "block").css("top", $(".sidebar-selection").offset().top);
        // Remove tabs styling of toolbar
        $(".content").removeClass("tabs");
        // Remove squeeze event bindings
        $("#open-files-container").find("ul").unbind("DOMSubtreeModified");
        $(window).unbind("resize", squeeze);
        // Focus current file again to reset selection metrics
        FileViewController.openAndSelectDocument(DocumentManager.getCurrentDocument().file.fullPath, FileViewController.getFileSelectionFocus());
        // Initiate editor resize for consistency
        EditorManager.resizeEditor();
        tabsVisible = false;
    }
    
    /**
	 * Determine whether to hide tabs or show tabs on load
	 */
    function toggleTabs() {
        if ($("#sidebar").is(":visible")) {
            hideTabs();
        } else {
            showTabs();
        }
    }
    
    /**
	 * Toggle sidebar & tabs
	 * @param  {Number} width Width of sidebar (placeholder)
	 */
    function toggleSidebar(width) {
        Resizer.toggle($("#sidebar"));
        toggleTabs();
    }
    
    /**
	 * @private
	 * Redraw selection when list size changes or DocumentManager currentDocument changes.
	 */
    function _fireSelectionChanged() {
        // redraw selection
        $openFilesList.trigger("selectionChanged");
        
        // in-lieu of resize events, manually trigger contentChanged to update scroll shadows
        $openFilesContainer.triggerHandler("contentChanged");
    }
    
    /**
	 * Starts the drag and drop working set view reorder.
	 * @private
	 * @param {!Event} event - jQuery event
	 * @paran {!HTMLLIElement} $listItem - jQuery element
	 * @param {?bool} fromClose - true if reorder was called from the close icon
	 */
    function _reorderListItem(event, $listItem, fromClose) {
        
        var $dataListItem   = $(".main-view").find("#open-files-container li"),
            $prevListItem   = $listItem.prev(),
            $nextListItem   = $listItem.next(),
            selected        = $listItem.hasClass("selected"),
            prevSelected    = $prevListItem.hasClass("selected"),
            nextSelected    = $nextListItem.hasClass("selected"),
            index           = DocumentManager.findInWorkingSet($listItem.data("file").fullPath),
            width           = $listItem.width(),
            startPageX      = event.pageX,
            listItemTop     = startPageX - $listItem.offset().left,
            listItemBottom  = $listItem.offset().left + width - startPageX,
            offsetTop       = $openFilesContainer.offset().left,
            scrollElement   = $openFilesContainer.get(0),
            containerWidth  = scrollElement.clientWidth,
            maxScroll       = scrollElement.scrollWidth - containerWidth,
            hasScroll       = scrollElement.scrollWidth > containerWidth,
            hasBottomShadow = scrollElement.scrollWidth > scrollElement.scrollLeft + containerWidth,
            addBottomShadow = false,
            interval        = false,
            moved           = false;
        
        // Sidebar - needs vertical properties
        if (!tabsVisible) {
            width           = $listItem.height();
            startPageX      = event.pageY;
            listItemTop     = startPageX - $listItem.offset().top;
            listItemBottom  = $listItem.offset().top + width - startPageX;
            offsetTop       = $openFilesContainer.offset().top;
            containerWidth  = scrollElement.clientHeight;
            maxScroll       = scrollElement.scrollHeight - containerWidth;
            hasScroll       = scrollElement.scrollHeight > containerWidth;
            hasBottomShadow = scrollElement.scrollHeight > scrollElement.scrollTop + containerWidth;
        }
        
        function drag(e) {
            var left = ((tabsVisible) ? e.pageX : e.pageY) - startPageX;
            
            // Drag if the item is not the first and moving it up or
            // if the item is not the last and moving down
            if (($prevListItem.length && left < 0) || ($nextListItem.length && left > 0)) {
                // Reorder the list once the item is halfway to the new position
                if (Math.abs(left) > width / 2) {
                    // If moving up, place the previows item after the moving item
                    if (left < 0) {
                        $prevListItem.insertAfter($listItem);
                        startPageX -= width;
                        left = left + width;
                        DocumentManager.swapWorkingSetIndexes(index, --index);
                        // If moving down, place the next item before the moving item
                    } else {
                        $nextListItem.insertBefore($listItem);
                        startPageX += width;
                        left = left - width;
                        DocumentManager.swapWorkingSetIndexes(index, ++index);
                    }
                    
                    // Update the selection when the previows or next element were selected
                    if (!selected && ((left > 0 && prevSelected) || (left < 0 && nextSelected))) {
                        _fireSelectionChanged();
                    }
                    
                    // Update the previows and next items
                    $prevListItem = $listItem.prev();
                    $nextListItem = $listItem.next();
                    prevSelected  = $prevListItem.hasClass("selected");
                    nextSelected  = $nextListItem.hasClass("selected");
                    
                    // If the last item of the list was selected and the previows was moved to its location, then
                    // the it will show a bottom shadow even if it shouldnt because of the way the scrollHeight is 
                    // handle with relative position. This will remove that shadow and add it on drop. 
                    if (!addBottomShadow && !hasBottomShadow && !$nextListItem.length && prevSelected) {
                        ViewUtils.removeScrollerShadow($openFilesContainer[0], null);
                        ViewUtils.addScrollerShadow($openFilesContainer[0], null, false);
                        addBottomShadow = true;
                    }
                }
                // Set the left to 0 as the event probably didnt fired at the exact start/end of the list 
            } else {
                left = 0;
            }
            
            // Move the item
            if (tabsVisible) {
                $listItem.css("left", left + "px").css("top", 0);
            } else {
                $listItem.css("top", left + "px").css("left", 0);
            }
            
            // Update the selection position
            if (selected) {
                _fireSelectionChanged();
            }
            
            // Once the movement is greater than 3 pixels, it is assumed that the user wantes to reorder files and not open
            if (!moved && Math.abs(left) > 3) {
                Menus.closeAll();
                moved = true;
            }
        }
        
        function endScroll() {
            window.clearInterval(interval);
            interval = false;
        }
        
        function scroll(e) {
            var dir = 0;
            // Mouse over the first visible pixels and moving up
            if (e.pageX - listItemTop < offsetTop + 7) {
                dir = -1;
                // Mouse over the last visible pixels and moving down
            } else if (e.pageX + listItemBottom > offsetTop + containerWidth - 7) {
                dir = 1;
            }
            
            if (dir && !interval) {
                // Scroll view if the mouse is over the first or last pixels of the container
                interval = window.setInterval(function () {
                    var scrollTop = $openFilesContainer.scrollTop();
                    // End scroll if there isn"t more to scroll
                    if ((dir === -1 && scrollTop <= 0) || (dir === 1 && scrollTop >= maxScroll)) {
                        endScroll();
                        // Scroll and drag list item
                    } else {
                        $openFilesContainer.scrollTop(scrollTop + 7 * dir);
                        startPageX -= 7 * dir;
                        drag(e);
                    }
                }, 100);
            } else if (!dir && interval) {
                endScroll();
            }
        }
        
        function drop() {
            // Enable Mousewheel
            window.onmousewheel = window.document.onmousewheel = null;
            
            // Removes the styles, placing the item in the chosen place
            $listItem.removeAttr("style");
            
            // End the scrolling if needed
            if (interval) {
                window.clearInterval(interval);
            }
            
            // If file wasnt moved open or close it
            if (!moved) {
                if (!fromClose) {
                    /***/
                    FileViewController.openAndSelectDocument($listItem.data("file").fullPath, FileViewController.WORKING_SET_VIEW);
                    /***
					// Backing out for Sprint 18 due to issues described in #2394, #2411
					if (selected) {
						CommandManager.execute(Commands.FILE_RENAME);
					} else {
						FileViewController.openAndSelectDocument($listItem.data(_FILE_KEY).fullPath, FileViewController.WORKING_SET_VIEW);
					}
					***/
                } else {
                    CommandManager.execute(Commands.FILE_CLOSE, {file: $dataListItem.data(_FILE_KEY)});
                }
            } else if (moved) {
                if (selected) {
                    // Update the file selection
                    _fireSelectionChanged();
                    ViewUtils.scrollElementIntoView($openFilesContainer, $listItem, false);
                }
                if (addBottomShadow) {
                    // Restore the shadows
                    ViewUtils.addScrollerShadow($openFilesContainer[0], null, true);
                }
            }
        }
        
        // Only drag with the left mouse button, and control key is not down
        // on Mac, end the drop in other cases
        if (event.which !== 1 || (event.ctrlKey && brackets.platform === "mac")) {
            drop();
            return;
        }
        
        // Disable Mousewheel while dragging
        window.onmousewheel = window.document.onmousewheel = function (e) {
            e.preventDefault();
        };
        
        // Style the element
        $listItem.css("position", "relative").css("z-index", 3);
        if (!$listItem.hasClass("selected")) {
            $listItem.css("box-shadow", "none");
        }
        
        // Event Handlers
        $openFilesContainer.on("mousemove.workingSet", function (e) {
            if (hasScroll) {
                scroll(e);
            }
            drag(e);
        });
        $openFilesContainer.on("mouseup.workingSet mouseleave.workingSet", function (e) {
            $openFilesContainer.off("mousemove.workingSet mouseup.workingSet mouseleave.workingSet");
            drop();
        });
    }
    
    $("#open-files-container").mousedown(function (e) {
        // Get the index of list item selected
        var place = $(e.target.parentElement).index();
        _reorderListItem(e, $(this).find("ul > li:nth-child(" + (place + 1) + ")"), false);
        e.preventDefault();
    });
    
    // Register new functions as default; replace keybinding trigger functions
    CommandManager.register("Toggle Sidebar and Tabs", "toggle-sidebar-tabs", toggleSidebar);
    KeyBindingManager.removeBinding("Ctrl-Shift-H");
    KeyBindingManager.addBinding("toggle-sidebar-tabs", "Ctrl-Shift-H");
    
    var menu = Menus.getMenu(Menus.AppMenuBar.VIEW_MENU);
    menu.addMenuItem("toggle-sidebar-tabs", "Ctrl-Shift-H", "after", "view.hideSidebar");
    
    // Initiate tabs
    toggleTabs();
    
});