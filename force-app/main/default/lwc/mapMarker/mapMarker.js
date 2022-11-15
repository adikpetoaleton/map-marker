import { LightningElement, track, api } from 'lwc';
import { OmniscriptBaseMixin } from 'vlocity_ins/omniscriptBaseMixin';

import LightningConfirm from "lightning/confirm";

export default class MapMarker extends OmniscriptBaseMixin(LightningElement) {

    /**
     * GLOBAL SECTION
     */

    _jsonDataStack = [];                    // Data to be saved into Data JSON Omniscript (data selected)
    _regions;                               // JSON Payload representing Regions Locations and Names
    _mapResource;
    _markerResource;
    _adminMode;                             // Admin Mode
    _mapWidth_px;                           // Map Width provided by the User
    _mapHeight_px;                          // Map Height provided by the User
    _regionsCount;                          // Regions count provided by the User to calculate Clickable zone size
    _areaAdjustmentRatio;                   // User can provide an adujstment for the Clickable zone size

    MARKER_AREA_RATIO = 0.3;

    _offset_px;                             // Area location need to be shifted back by 0.5 the size of it
    _areaAjustedSide;                       // User can provide an adujstment for the Clickable zone size
    _areaNormalizedSide_px;                 // Size of one side of the Clickable zone (Area)
    _markerResourceOriginalWidth_px;
    _markerResourceOriginalHeight_px;
    _markerResourceSizeFactor;
    _markerResourceFinalWidth_px;
    _markerResourceFinalHeight_px;
    _areaAjustedWidth;
    _areaAjustedHeight;
    _spots;
    _parent;
    _spotWidth;
    _spotHeight;
    _spotWidth_px;
    _spotHeight_px;

    // For Modal only
    _selectedItemId;
    _userInput;
    // _currentListBoxItem;
    // _currentListBoxItemIndex = -1;
    @track isShowModal = false;
    @track selectedItemName;
    @track itemsFoundlist = this._regions;
    @track showItems = false;
    @track noResultFound = false;
    @track currentLocation;
    @track isAlreadySelected = false;

    /**
     * PUBLIC SECTION
     */

    // Admin Mode
    @api
    get adminMode() {
        return this._adminMode;
    }
    set adminMode(value) {
        if (value) {
            this._adminMode = (value == "True" || value == "true") ? true : false;
        }
    }

    // Area (Clickable Zone) size adjustment
    @api
    get areaAdjustment() {
        return this._areaAdjustmentRatio;
    }
    set areaAdjustment(value) {
        if (value) {
            this._areaAdjustmentRatio = parseFloat(value);
        }
    }

    // Regions Number
    @api
    get selectedRegions() {
        return this._jsonDataStack;
    }

    // Regions Number
    @api
    get regionsCount() {
        return this._regionsCount;
    }
    set regionsCount(value) {
        if (value) {
            this._regionsCount = parseInt(value);
        }
    }

    // Regions list
    @api
    get regions() {
        return this._regions;
    }
    set regions(value) {
        if (value) {
            this._regions = value;
        }
    }

    // Map Resource
    @api
    get mapResource() {
        return this._mapResource;
    }
    set mapResource(value) {
        if (value) {
            this._mapResource = value;
        }
    }

    // Marker Resource
    @api
    get markerResource() {
        return this._markerResource;
    }
    set markerResource(value) {
        if (value) {
            this._markerResource = value;
        }
    }

    /**
     * EVENTS SECTION
     */

    renderedCallback() {
        // Positionnement des zones clickables sur la carte.
        setTimeout(() => this.doInitializeDOM(), 1000);
    }

    onClickHandler(event) {

        const target = event.target.className;

        switch (target) {

            case 'mapResource':
                if (this._adminMode) {
                    this.doLocateMouse(event);
                }
                break;

            case 'spots':
                this.doLocateMouse(event);
                break;

            case 'area':
                this.doUpdateSelectedRegions(event);
                break;

            case 'tag':
                if (this._adminMode) {
                    this.doUpdateSpottedRegions(event);
                } else {
                    this.doUpdateSelectedRegions(event);
                }
                break;

            case 'spot':
                this.doUpdateSpottedRegions(event);
                break;
        }

    }

    //[Runtime] 
    async onConfirmMapResetHandler() {

        if (Array.isArray(this._jsonDataStack) && this._jsonDataStack.length > 0) {
            const result = await LightningConfirm.open({
                message: "Are you sure you want to continue?",
                variant: "default",
                theme: "warning",
                label: "Reset the Map"
            });

            //result is true if OK was clicked
            if (result) {
                this.doClearMap();
            }
        }

    }


    handleOpenModal() {
        this.isShowModal = true;
        //setTimeout(() => this.template.querySelector('.search').focus());
    }

    handleCloseModal(event) {

        event.stopPropagation();

        this.isShowModal = false;
        this.showItems = false;
        this.noResultFound = false;

        var target = event.target.dataset.id;

        switch (target) {
            case 'exit':
                this.selectedItemName = '';
                this._selectedItemId = '';
                this._currentListBoxItemIndex = -1;
                break;
            case 'cancel':
                this.selectedItemName = '';
                this._selectedItemId = '';
                this._currentListBoxItemIndex = -1;
                break;
            case 'save':

                this.doAppendRegionLocation(this._selectedItemId, this.selectedItemName, this.currentLocation.x, this.currentLocation.y);
                this.selectedItemName = '';
                this._selectedItemId = '';
                this._currentListBoxItemIndex = -1;
                break;

        }

        this.isAlreadySelected = false;

    }

    handleUserAction(event) {

        event.stopPropagation();

        var classList = event.target.classList;
        var isModalSource = classList.contains('slds-modal__header') || classList.contains('slds-modal') || classList.contains('slds-modal__container') || 
        classList.contains('slds-modal__title') || classList.contains('slds-modal__content') || classList.contains('slds-modal__footer');
        var isSearch = classList.contains('search')
        var isListbox = classList.contains('slds-truncate') || classList.contains('slds-media__body')
        var userInput = event.target.value;
        
        if (event.type == 'click') {
            
            if(isListbox){
                this._selectedItemId = parseInt(event.target.dataset.itemid);
                this.doUpdateComboBox(null, false ,event.target.dataset.name, this.isItemCurrentlySelected(this._selectedItemId), false);
            }
            
            if(isModalSource){
                this.doUpdateComboBox(null, false, null, null, false);
                this.template.querySelector('.search').blur();
            }

            if(isSearch){
                if (userInput === '') {
                    this.doUpdateComboBox(this._regions, true, null, null, null);
                } else {
                    this.itemsFoundlist = this._regions.filter(item => this.isIncludes(item, userInput));
                    if (this.itemsFoundlist.length > 0) {
                        this.doUpdateComboBox(null, true, null, null, false);
                    } else {
                        this.doUpdateComboBox(null, false, null, null, true);
                    }
                }
            }

        }

        if (event.type == 'change') {

            if(isSearch){
                if (userInput === '') {
                    this.doUpdateComboBox(this._regions, true, '', false, false);
                } else {
                    this.itemsFoundlist = this._regions.filter(item => this.isIncludes(item, userInput));
                    if (this.itemsFoundlist.length > 0) {
                        this.doUpdateComboBox(null, true, null, null, false);
                    } else {
                        this.doUpdateComboBox(null, false, null, null, true);
                    }
                }
            }
        }

        // if (event.type == 'keydown') {

        //     var l = this.itemsFoundlist.length;

        //     if (l > 0) {
        //         var keyCode = event.keyCode;

        //         /* Up */
        //         if(keyCode == 38) {

        //             if(this._currentListBoxItemIndex > 0 && this._currentListBoxItemIndex <l) {
        //                 var itemName = this.itemsFoundlist[this._currentListBoxItemIndex].name;
        //                 this._currentListBoxItem = this.template.querySelector(`[data-name="${itemName}"]`);
        //                 this._currentListBoxItem.style.removeProperty("background-color");
        //             }

        //             if(this._currentListBoxItemIndex > 0)
        //                 this._currentListBoxItemIndex -= 1;
                    
        //             var itemName = this.itemsFoundlist[this._currentListBoxItemIndex].name;
        //             this._currentListBoxItem = this.template.querySelector(`[data-name="${itemName}"]`);
        //             this._currentListBoxItem.style.backgroundColor = "#F5F5F5";
        //             this.selectedItemName = itemName;
                    
        //         }

        //         /* Down */
        //         if(keyCode == 40) {

        //             if(this._currentListBoxItemIndex < l - 1 && this._currentListBoxItemIndex >= 0) {
        //                 var itemName = this.itemsFoundlist[this._currentListBoxItemIndex].name;
        //                 this._currentListBoxItem = this.template.querySelector(`[data-name="${itemName}"]`);
        //                 this._currentListBoxItem.style.removeProperty("background-color");
        //             }

        //             if(this._currentListBoxItemIndex < l-1)
        //                 this._currentListBoxItemIndex += 1;

        //             var itemName = this.itemsFoundlist[this._currentListBoxItemIndex].name;
        //             this._currentListBoxItem = this.template.querySelector(`[data-name="${itemName}"]`);
        //             this._currentListBoxItem.style.backgroundColor = "#F5F5F5";
        //             this.selectedItemName = itemName;
        //         }


        //         if(keyCode == 13) {
        //             if(isSearch){
        //                 this._selectedItemId = parseInt(this.itemsFoundlist[this._currentListBoxItemIndex].id);
        //                 this.doUpdateComboBox(null, false ,this.selectedItemName, this.isItemCurrentlySelected(this._selectedItemId), false);
        //                 this.template.querySelector('.search').blur();
        //             }
        //         }
        //     }
        //     console.log("KeyCode: " + event.keyCode);
        // }
        
        // console.log("type : " + event.type);
        // console.log("classList : " + event.target.classList);
        // console.log("id : " +  event.target.id);

    }

     /**
     * PRIVATE FUNCTIONS SECTION
     */

    //[Runtime] Adding selected item to the stack
    doAppendItemToStack(value) {

        if (value) {
            this._jsonDataStack.push(value);
        }

    }

    //[Admin] 
    doAppendRegionLocation(id, name, x, y) {

        var newRegion = {
            id: id,
            name: name,
            x: x,
            y: y
        };

        var left = (parseFloat(x - this._spotWidth_px / 2) / this._mapWidth_px) * 100;
        var top = (parseFloat(y - this._spotHeight_px / 2) / this._mapHeight_px) * 100;

        var div = document.createElement('div');
        div.id = id;
        div.innerHTML = `<div class="spot" data-key=${id} style="position:absolute; left:${left}%; top:${top}%; width:${this._spotWidth}%; height:${this._spotHeight}%;"></div>`;
        this._spots.appendChild(div);

        this.doAppendItemToStack(newRegion);
        this.omniUpdateDataJson(this._jsonDataStack, true);

    }

    //[Admin] 
    doCheckRegionInfoFormat(value) {

        if (value) {
            var info = value.split(',');
            if ((Array.isArray(info))) {
                var isNumberFirstToken = Number.isInteger(parseInt(info[0]));
                return ((info.length === 2) && isNumberFirstToken)
            }
        }
        return false

    }

    //[Runtime] 
    doClearMap() {

        for (var r of this._regions) {
            var marker = this.template.querySelector(`[data-idx="${r.id}"]`);
            marker.classList.remove('markerVisible');
            marker.classList.add('markerHidden');
        }

        this._jsonDataStack = [];
        this.omniUpdateDataJson(this._jsonDataStack, true);

    }

    // Positionnement et dimensionnement des différents composants en fonction de la taille de l'image (Carte)
    doInitializeDOM() {

        /**
         * INITIALISATION DU CANEVAS
         */

        // Je récupère la taille originale de la carte
        var mapResource = this.template.querySelector(".mapResource");
        if (mapResource) {
            this._mapWidth_px = mapResource.naturalWidth;
            this._mapHeight_px = mapResource.naturalHeight;
        }

        // Je défini la taille maximale du Canvas (DIV qui contient la carte)
        var mapCanvas = this.template.querySelector(".canvas");

        if (mapCanvas) {
            mapCanvas.style.maxWidth = this._mapWidth_px.toString() + "px";
            mapCanvas.style.maxHeight = this._mapHeight_px.toString() + "px";

            // Highlight Admin Mode
            if (this._adminMode) {
                mapCanvas.style.borderStyle = "dashed";
                mapCanvas.style.borderColor = "red";
                mapCanvas.style.borderWidth = "1px";
                mapCanvas.style.cursor = "crosshair";
            }
        }

        /**
         * INITIALISATION DES ZONES CLICKABLES
         */

        // J'en déduis la dimension brute (sans facteur d'ajustement) d'une zone clickable.
        this._areaNormalizedSide_px = Math.sqrt((parseFloat(this._mapWidth_px) * parseFloat(this._mapHeight_px)) / this._regionsCount);

        // Je calcule en pourcentage la dimension de la clickable en applicant une correction (areaRatio) dûe au fait que la carte n'occupe pas 100% de l'image.
        this._areaAjustedWidth = (((this._areaNormalizedSide_px * this._areaAdjustmentRatio) / this._mapWidth_px) * 100);
        this._areaAjustedHeight = (((this._areaNormalizedSide_px * this._areaAdjustmentRatio) / this._mapHeight_px) * 100);

        // Légère correction pour positionner la zone clickable bien au centre.
        this._offset_px = (this._areaNormalizedSide_px * this._areaAdjustmentRatio) / 2;

        // Je parcours la liste des régions pour positionner toutes les zones clickables ou initialiser spots en mode Admin
        if (!this._adminMode) {
            this.doInitAreas();
        } else {
            this.doInitSpots(mapResource);
        }

        /**
         * INITIALISATION DU MARKER
         */
        if (!this._adminMode) {
            // Je récupère la taille originale du Marker
            var markerResource = this.template.querySelector(".markerHidden");
            // REMARQUE : Précaution prise car lorsque les Tags se dessinent, la foncvtion renderedCallback() est rappelée à l'ajout d'un
            // nouveau Tag. Il arrive un moment où il n'y a plus de markerHidden car ils on tous été affichés.
            // Dans l'idéal, l'initialisation de la taille du marker ne devrait se faire à l'intérieur d'une callback funtion qui n'est 
            // appelé qu'une seule fois au charchement du composant...à améliorer unjour maybe ;-)
            if (markerResource) {
                this._markerResourceOriginalWidth_px = markerResource.naturalWidth;
                this._markerResourceOriginalHeight_px = markerResource.naturalHeight;

                // Je calcule la dimension idéale (Width / Height) d'un Marker en fonction
                this._markerResourceSizeFactor = this._markerResourceOriginalHeight_px / this._markerResourceOriginalWidth_px;
                this._markerResourceFinalWidth_px = (this._areaNormalizedSide_px * this._areaAdjustmentRatio) * this.MARKER_AREA_RATIO;
                this._markerResourceFinalHeight_px = this._markerResourceFinalWidth_px * this._markerResourceSizeFactor;
            }
        } else {
            this._spotWidth_px = parseFloat(this._areaNormalizedSide_px * this._areaAdjustmentRatio * this.MARKER_AREA_RATIO);
            this._spotHeight_px = this._spotWidth_px;
            this._spotWidth = (this._spotWidth_px / this._mapWidth_px) * 100;
            this._spotHeight = (this._spotHeight_px / this._mapHeight_px) * 100;
            this._spots = this.template.querySelector('.spots');
            this._spots.style.width = "100%";
            this._spots.style.height = "100%";
        }

    }

    // [Admin] Area Initialization
    doInitSpots(mapResource) {

        // J'initialise ma zone de spots
        this._parent = this.template.querySelector('.parent');
        this._parent.style.maxWidth = this._mapWidth_px.toString() + "px";
        this._parent.style.maxHeight = this._mapHeight_px.toString() + "px";
        this._parent.style.position = "absolute";
        this._parent.style.left = "0px";
        this._parent.style.top = "0px";

    }

    // [Runtime] Area Initialization
    doInitAreas() {

        for (var r of this._regions) {

            // Je pointe sur une zone clickable (element type DIV).
            const currentArea = this.template.querySelector(`[data-id="${r.id}"]`);

            // Je configure en pourcentage les dimensions de la zone clickable.
            currentArea.style.width = (this._areaAjustedWidth).toString() + "%";
            currentArea.style.height = (this._areaAjustedHeight).toString() + "%";

            // Je configure en pourcentage les coordonnées de la zone clickable.
            var areaLeft = (parseFloat(r.x - this._offset_px) / this._mapWidth_px) * 100;
            var areaTop = (parseFloat(r.y - this._offset_px) / this._mapHeight_px) * 100;
            currentArea.style.left = areaLeft.toString() + "%";
            currentArea.style.top = areaTop.toString() + "%";

        }

    }

    //[Admin] Track mouse position and display mouse coordinates
    async doLocateMouse(event) {

        var canvas = event.target.getBoundingClientRect();

        // Coordonnées apparente (dépend du zoom de la fenêtre) de la souris
        var xApparent = parseInt(event.clientX - canvas.left);
        var yApparent = parseInt(event.clientY - canvas.top);
        var wApparent = canvas.width;
        var hApparent = canvas.height;

        var xReal = parseInt((xApparent / wApparent) * this._mapWidth_px);
        var yReal = parseInt((yApparent / hApparent) * this._mapHeight_px);

        this.currentLocation = {
            x: xReal,
            y: yReal
        }

        this.handleOpenModal();

    }

    //[Runtime] Removing selected item from the Stack
    doRemoveItemFromStack(value) {

        if (value) {
            this._jsonDataStack = this._jsonDataStack.filter(data => data.id != value);
        }

    }

    //[Admin] Removing selected spot from the Stack
    doRemoveSpotFromStack(value) {

        if (value) {
            this._jsonDataStack = this._jsonDataStack.filter(data => data.id != value);
        }

    }

    //[Runtime] Show or Hide Marker when user click on Map
    doUpdateSelectedRegions(event) {

        // Do not reload page
        event.preventDefault();

        // Extraction des informations de la zone cliquée
        var areaId = parseInt(event.target.dataset.id);
        var areaName = event.target.dataset.name;
        var areaLeft = parseInt(event.target.dataset.x);
        var areaTop = parseInt(event.target.dataset.y);

        // Je pointe sur le marqueur dont l'identifiant corresponds à celui de la zone activée.
        var selectedMarker = this.template.querySelector(`[data-idx="${areaId}"]`);

        // Je calcule en pourcentage la position et la taille du Marker de la zone activée.
        var markerLeft = (parseFloat(areaLeft - this._markerResourceFinalWidth_px / 2) / this._mapWidth_px) * 100;
        var markerTop = (parseFloat(areaTop - this._markerResourceFinalHeight_px) / this._mapHeight_px) * 100;

        var markerWidth = (parseFloat(this._markerResourceFinalWidth_px) / this._mapWidth_px) * 100;

        // Je positionne le Marker.
        selectedMarker.style.left = markerLeft.toString() + "%";
        selectedMarker.style.top = markerTop.toString() + "%";
        selectedMarker.style.width = markerWidth.toString() + "%";

        // Ce sont ces informations qui seront transférés à l'OmniScript
        var selectedRegion = {
            id: areaId,
            name: areaName,
            x: areaLeft,
            y: areaTop
        };

        // J'affiche ou je masque le MapPin et je met à jour le tableau des régions sélectionnées
        if (this.isItemCurrentlySelected(areaId)) {
            selectedMarker.classList.remove('markerVisible');
            selectedMarker.classList.add('markerHidden');
            this.doRemoveItemFromStack(areaId);
        } else {
            selectedMarker.classList.add('markerVisible');
            selectedMarker.classList.remove('markerHidden');
            this.doAppendItemToStack(selectedRegion);
        }
        this.omniUpdateDataJson(this._jsonDataStack, true);

    }

    doUpdateSpottedRegions(event) {

        // Do not reload page
        event.preventDefault();

        /* PAS TERRIBLE */
        /* ON UTILISE KEY POUR LE SPOT ET NAME POUR LE TAG...BURK */
        if (event.target.className === 'tag') {
            var spotName = parseInt(event.target.dataset.id);
        } else {
            var spotName = parseInt(event.target.dataset.key);
        }
        var selectedSpot = this.template.querySelector(`[data-key="${spotName}"]`);
        var selectedSpotParent = this.template.querySelector(`[id="${spotName}"]`);

        selectedSpotParent.removeChild(selectedSpot);
        this._spots.removeChild(selectedSpotParent);

        this.doRemoveSpotFromStack(spotName);
        this.omniUpdateDataJson(this._jsonDataStack, true);

    }

    //[Runtime] Checking weither the selected item is in the stack, in order to remove it or not
    isItemCurrentlySelected(value) {

        if (value) {
            const item = this._jsonDataStack.filter(data => data.id == value);
            return !!item.length;
        }

    }

    isIncludes(item, userInput) {
        var isInputInNames = item.name.toLowerCase().includes(userInput.toLowerCase());
        var isInputInIds = item.id.toString().includes(userInput.toLowerCase());
        return (isInputInNames || isInputInIds);
    }

    doUpdateComboBox(listBoxItems, isShowListBoxItems, selectedValue, isSelectedAlready, isNoResultFound) {
        if (listBoxItems != null)
            this.itemsFoundlist = listBoxItems;
        if (isShowListBoxItems != null)
            this.showItems = isShowListBoxItems;
        if (selectedValue != null)
            this.selectedItemName = selectedValue;
        if (isSelectedAlready != null)
            this.isAlreadySelected = isSelectedAlready;
        if (isNoResultFound != null)
            this.noResultFound = isNoResultFound;
    }

}