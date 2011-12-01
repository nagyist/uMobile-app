/*
 * Licensed to Jasig under one or more contributor license
 * agreements. See the NOTICE file distributed with this work
 * for additional information regarding copyright ownership.
 * Jasig licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file
 * except in compliance with the License. You may obtain a
 * copy of the License at:
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on
 * an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */


exports.states = {
    INCLUDED    : "Included",
    INITIALIZED : "Initialized",
    LOADING     : "Loading",
    COMPLETE    : "Complete",
    HIDDEN      : "Hidden"
};

exports.events = {
    STATE_CHANGE    : 'PortalGridViewStateChange'
};

var _completeWidth, _completeHeight, _numColumns, _leftPadding, _didLayoutCleanup = false, _state, _numGridItems = 0, _gridView, _gridItems = {};

function _init () {
    _completeWidth = app.styles.gridItem.width + 2 * app.styles.gridItem.padding;
    _completeHeight = app.styles.gridItem.width + 2 * app.styles.gridItem.padding;
    _numColumns = Math.floor(app.models.deviceProxy.getWidth() / _completeWidth);
    _leftPadding = Math.floor(((app.models.deviceProxy.getWidth() - (_completeWidth * _numColumns))) / 2);
    
    Ti.App.addEventListener(app.events['STYLESHEET_UPDATED'], _onRotation);
    Ti.App.addEventListener(app.events['DIMENSION_CHANGES'], _onOrientationChange);
    Ti.App.addEventListener(app.events['LAYOUT_CLEANUP'], _onLayoutCleanup);
    
    _gridView = Titanium.UI.createScrollView(app.styles.homeGrid);
    
    exports.setState(exports.states.INITIALIZED);
};

exports.getState = function () {
    return _state;
};

exports.setState = function (newState) {
    Ti.API.debug("setState() in PortalGridView: " + newState);
    _state = newState;
    Ti.App.fireEvent(exports.events['STATE_CHANGE'], {state: _state});
    
};

exports.getGridView = function () {
    if (_didLayoutCleanup || !_gridView) {
        _gridView = Titanium.UI.createScrollView(app.styles.homeGrid);
    }
    _rearrangeGrid();
    return _gridView;
};

exports.updateGrid = function (portlets) {
    var _portlets = portlets || [], _item;

    /*
    * In this method, we're comparing portlets from the portalProxy (Portal) with our local 
    * collection of portlets.
    * First we iterate through our local items, and see if they exist in the new array.
    * If not, we destroy them (which removes them from the view, and the _gridItems collection)
    * then we iterate through the latest correction from the portalProxy and add them if they don't exist.
    */
    _numGridItems = _portlets.length || 0;
    for (_item in _gridItems) {
        if (_gridItems.hasOwnProperty(_item)) {
            for (var j=0; j<_numGridItems; j++) {
                if ('fName' + _portlets[j].fname === _item) {
                    // Ti.API.debug("Not destroying: " + _item);
                    break;
                }
                else if (j == _numGridItems - 1) {
                    // Ti.API.info("About to destroy" + _item + " & is destroy defined? " + _gridItems[_item].destroy);
                    _gridItems[_item].destroy();
                }
                else {
                    // Ti.API.info("Didn't destroy " + _item + " because it wasn't " + _portlets[j].fname);
                }
            }
        }
    }
    
    for (var i=0; i<_numGridItems; i++ ) {
        //Place the item in the scrollview and listen for singletaps
        if (!_gridItems['fName' + _portlets[i].fname] || app.models.deviceProxy.isIOS()) {
            // Ti.API.debug("!_gridItems['fName' + _portlets[i].fname]");
            //Create the item, implicity add to local array, and explicitly assign sort order
            _gridView.add(_createGridItem(_portlets[i], i).view);
        }
        else {
            // Ti.API.debug("else");
            //We just need to tell the item its new sort order
            _gridItems['fName' + _portlets[i].fname].sortOrder = i;
            _gridItems['fName' + _portlets[i].fname].view.show();
            _gridItems['fName' + _portlets[i].fname].view.visible =true;
            _gridItems['fName' + _portlets[i].fname].addEventListeners();
        }
    }
    
    _rearrangeGrid();
    _didLayoutCleanup = false;
};

function _createGridItem (portlet, sortOrder) {
    // Create the container for the grid item
    var gridItem = {}, gridItemLabel, gridItemIcon, gridBadgeBackground, gridBadgeNumber,
    gridItemDefaults = app.styles.gridItem, gridItemIconDefaults, gridBadgeBackgroundDefaults, gridBadgeNumberDefaults;
    if ('fName'+portlet.fname in _gridItems) {
        _gridItems['fName'+portlet.fname].view.show();
        _gridItems['fName'+portlet.fname].sortOrder = sortOrder;
        return _gridItems['fName'+portlet.fname];
    }
    else {
        gridItem.view = Ti.UI.createView(gridItemDefaults);

        gridItem.view.portlet = portlet;
        gridItem.sortOrder = sortOrder;

        //Add a label to the grid item
        if (portlet.title) {
            var gridItemLabelDefaults = app.styles.gridItemLabel;
            gridItemLabelDefaults.text =  portlet.title.toLowerCase();
            gridItemLabel = Ti.UI.createLabel(gridItemLabelDefaults);
            gridItem.view.add(gridItemLabel);
        }

        //Add an icon to the grid item
        gridItemIconDefaults = app.styles.gridIcon;
        gridItemIconDefaults.image = app.models.portalProxy.getIconUrl(portlet);
        gridItemIcon = Ti.UI.createImageView(gridItemIconDefaults);
        gridItemIcon.portlet = portlet;
        gridItem.view.add(gridItemIcon);

        // if the module has a new item count of more than zero (no new items)
        // add a badge number to the home screen icon
        if (portlet.newItemCount > 0) {
            gridBadgeBackgroundDefaults = app.styles.gridBadgeBackground;
            gridBadgeBackground = Ti.UI.createImageView(gridBadgeBackgroundDefaults);
            gridItem.view.add(gridBadgeBackground);

            gridBadgeNumberDefaults = app.styles.gridBadgeNumber;
            gridBadgeNumberDefaults.text = portlet.newItemCount;
            gridBadgeNumber = Ti.UI.createLabel(gridBadgeNumberDefaults);
            gridItem.view.add(gridBadgeNumber);
        }

        gridItem.view.visible = false;

        gridItem.destroy = function () {
            Ti.API.info("Destroying GridItem!");
/*            if (gridItem.view.getParent()) {
                Ti.API.info("GridItem has a parent");
                gridItem.view.getParent().remove(gridItem.view);
                delete _gridItems['fName'+portlet.fname];
            }
            else {
                Ti.API.error("gridItem doesn't have a parent");
            }*/
            gridItem.view.hide();
            gridItem.view.visible = false;
            gridItem.sortOrder = -1;
        };
        
        gridItem.addEventListeners = function () {
            gridItemIcon.addEventListener("singletap", _onGridItemClick);
            gridItemIcon.addEventListener("touchstart", _onGridItemPressDown);
            gridItemIcon.addEventListener(app.models.deviceProxy.isAndroid() ? 'touchcancel' : 'touchend', _onGridItemPressUp);
        };
        
        gridItem.removeEventListeners = function () {
            try {
                gridItemIcon.removeEventListener("singletap", _onGridItemClick);
                gridItemIcon.removeEventListener("touchstart", _onGridItemPressDown);
                gridItemIcon.removeEventListener(app.models.deviceProxy.isAndroid() ? 'touchcancel' : 'touchend', _onGridItemPressUp);
            }
            catch (e) {
                Ti.API.error("Couldn't remove event listeners");
            }
        };
        
        gridItem.addEventListeners();
        
        _gridItems['fName'+portlet.fname] = gridItem;

        return gridItem;
    }

};

function _rearrangeGrid (e) {
    var _gridItem;
    
    exports.resizeGrid((app.models.userProxy.isGuestUser() || !app.models.portalProxy.getIsPortalReachable()) ? true : false);
    
    for (_gridItem in _gridItems) {
        if (_gridItems.hasOwnProperty(_gridItem)) {
            _gridItems[_gridItem].view.top = app.styles.gridItem.padding + Math.floor(_gridItems[_gridItem].sortOrder / _numColumns) * _completeHeight;
            _gridItems[_gridItem].view.left = _leftPadding + app.styles.gridItem.padding + (_gridItems[_gridItem].sortOrder % _numColumns) * _completeWidth;
            _gridItems[_gridItem].view.show();
        }
    }
    
    exports.setState(_numGridItems > 0 ? exports.states.COMPLETE : exports.states.LOADING); 
};

exports.destroy = function () {
    Ti.App.removeEventListener(app.events['STYLESHEET_UPDATED'], _onRotation);
    Ti.App.removeEventListener(app.events['DIMENSION_CHANGES'], _onOrientationChange);
    Ti.App.removeEventListener(app.events['LAYOUT_CLEANUP'], _onLayoutCleanup);
    
    for (var _gridItem in _gridItems) {
        if (_gridItems.hasOwnProperty(_gridItems)) {
            _gridItem.removeEventListeners();
        }
    }
};

exports.resizeGrid = function (_isSpecialLayout) {
    //Variable tells if the special layout indicator is displayed or not
     if (_isSpecialLayout) {
        if (app.models.deviceProxy.isAndroid()) {
            _gridView.height = Ti.Platform.displayCaps.platformHeight - app.styles.titleBar.height - app.styles.homeGuestNote.height - 25; //20 is the height of the status bar
        }
        else {
            _gridView.height = (Ti.UI.currentWindow ? Ti.UI.currentWindow.height : Ti.Platform.displayCaps.platformHeight - 20) - app.styles.titleBar.height - app.styles.homeGuestNote.height;
        }
    }
    else {
        if (app.models.deviceProxy.isAndroid()) {
            _gridView.height = Ti.Platform.displayCaps.platformHeight - app.styles.titleBar.height - 25;//25 is the size of the status bar.
        }
        else {
            _gridView.height = (Ti.UI.currentWindow ? Ti.UI.currentWindow.height : Ti.Platform.displayCaps.platformHeight - 20) - app.styles.titleBar.height;
        }
    }
};

function _onRotation (e) {
    _completeWidth = app.styles.gridItem.width + 2 * app.styles.gridItem.padding;
    _completeHeight = app.styles.gridItem.width + 2 * app.styles.gridItem.padding;
    _numColumns = Math.floor(app.models.deviceProxy.getWidth() / _completeWidth);
    _leftPadding = Math.floor(((app.models.deviceProxy.getWidth() - (_completeWidth * _numColumns))) / 2);
};

function _onLayoutCleanup (e) {
    Ti.API.debug("onLayoutCleanup() in PortalGridView");
    if (e.win === app.config.HOME_KEY) {
        Ti.API.debug("current window is " + app.config.HOME_KEY);
        _didLayoutCleanup = true;
        exports.setState(exports.states.HIDDEN);
    }
    else {
        Ti.API.debug("current window is NOT " + app.config.HOME_KEY + ', it\'s ' + e.win);
    }
};

function _onOrientationChange (e) {
    if (app.models.windowManager.getCurrentWindow() === app.config.HOME_KEY || app.models.deviceProxy.isAndroid()) {
        //If the device is Android, we always want to rearrange the grid to 
        //account for the back button circumventing the windowManager
        _rearrangeGrid();
    }
};

function _onGridItemClick (e) {
    var func;
    if (e.source.portlet) {
        func = app.models.portalProxy.getShowPortletFunc(e.source.portlet);
        func();
    }
    else {
        Ti.API.error("No portlet was attached to the icon.");
    }
};

function _onGridItemPressDown (e) {
    if(app.models.deviceProxy.isIOS()) {
        if (e.source.type === 'gridIcon') {
            e.source.getParent().opacity = app.styles.gridItem.pressOpacity;
        }
        else {
            e.source.opacity = app.styles.gridItem.pressOpacity;
        }
    }
    else {
        Ti.API.debug("Not setting opacity of icon because Android doesn't support it.");
    }
};

_onGridItemPressUp = function (e) {
    if(app.models.deviceProxy.isIOS()) {
        if (e.source.type === 'gridIcon') {
            e.source.getParent().setOpacity(1.0);
        }
        else {
            e.source.setOpacity(1.0);
        }
    }
    else {
        Ti.API.debug("onGridItemPressUp condition wasn't met");
    }
};

_init();