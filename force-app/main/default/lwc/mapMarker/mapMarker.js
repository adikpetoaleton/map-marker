import { LightningElement, track, api } from 'lwc';
import { OmniscriptBaseMixin } from 'vlocity_ins/omniscriptBaseMixin';

// Changes

// DEBUG
import LightningConfirm from "lightning/confirm";
import LightningAlert from "lightning/alert";
// DEBUG

export default class MapMarker extends OmniscriptBaseMixin(LightningElement) {

    /**
     * GLOBAL SECTION
     */

    @track _jsonDataStack = [];             // Data to be saved into Data JSON Omniscript (data selected)
    @track _regions;                        // JSON Payload representing Regions Locations and Names
    @track _mapResource;
    @track _markerResource;

    @track _mapWidth_px;                    // Map Width provided by the User
    @track _mapHeight_px;                   // Map Height provided by the User
    @track _regionsCount;                   // Regions count provided by the User to calculate Clickable zone size
    @track _areaAdjustmentRatio;            // User can provide an adujstment for the Clickable zone size

    MARKER_AREA_RATIO = 0.3;

    _offset_px;                             // Area location need to be shifted back by 0.5 the size of it
    _areaAjustedSide;                       // User can provide an adujstment for the Clickable zone size
    _mapNormalizedSide_px;                  // SQRT(Width * Height)
    _areaNormalizedSide_px;                 // Size of one side of the Clickable zone (Area)
    _markerResourceOriginalWidth_px;
    _markerResourceOriginalHeight_px;
    _markerResourceSizeFactor;
    _markerResourceFinalWidth_px;
    _markerResourceFinalHeight_px;
    _areaAjustedWidth;
    _areaAjustedHeight;

    /**
     * PUBLIC SECTION
     */

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

    // Positionnement des zones clickables sur la carte.
    renderedCallback() {

        // Je récupère la taille originale de la carte
        var mapResource = this.template.querySelector(".mapResource");
        this._mapWidth_px = mapResource.naturalWidth;
        this._mapHeight_px = mapResource.naturalHeight;

        // Je défini la taille maximale du Canvas (DIV qui contient la carte)
        var mapCanvas = this.template.querySelector(".canvas");
        mapCanvas.style.maxWidth = this._mapWidth_px.toString() + "px";
        mapCanvas.style.maxHeight = this._mapHeight_px.toString() + "px";

        // Je normalise les dimensions de la carte pour pouvoir définir la taille moyenne de la zone clickable.
        this._mapNormalizedSide_px = Math.sqrt((parseFloat(this._mapWidth_px) * parseFloat(this._mapHeight_px)));

        // J'en déduis la dimension brute (sans facteur d'ajustement) de la zone clickable.
        this._areaNormalizedSide_px = Math.sqrt((parseFloat(this._mapWidth_px) * parseFloat(this._mapHeight_px)) / this._regionsCount);

        // Je calcule en pourcentage la dimension de la clickable en applicant une correction (areaRatio) dûe au fait que la carte n'occupe pas 100% de l'image.
        this._areaAjustedWidth = (((this._areaNormalizedSide_px * this._areaAdjustmentRatio) / this._mapWidth_px) * 100);
        this._areaAjustedHeight = (((this._areaNormalizedSide_px * this._areaAdjustmentRatio) / this._mapHeight_px) * 100);

        // Légère correction pour positionner la zone clickable bien au centre.
        this._offset_px = (this._areaNormalizedSide_px * this._areaAdjustmentRatio) / 2;

        // Je parcours la liste des régions pour positionner toutes les zones clickables.
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

        // Je récupère la taille originale du Marker
        var markerResource = this.template.querySelector(".markerHidden");
        this._markerResourceOriginalWidth_px = markerResource.naturalWidth;
        this._markerResourceOriginalHeight_px = markerResource.naturalHeight;

        // Je calcule les dimensions idéales (Width / Height) d'un Marker à l'initialisation
        this._markerResourceSizeFactor = this._markerResourceOriginalHeight_px / this._markerResourceOriginalWidth_px;
        this._markerResourceFinalWidth_px = (this._areaNormalizedSide_px * this._areaAdjustmentRatio) * this.MARKER_AREA_RATIO;
        this._markerResourceFinalHeight_px = this._markerResourceFinalWidth_px * this._markerResourceSizeFactor;

    }

    onMapClickHandler(event) {

        // Do not reload page
        event.preventDefault();

        // Extraction des informations de la zone cliquée
        var areaId = event.target.dataset.id;
        var areaName = event.target.dataset.name;
        var areaLeft = event.target.dataset.x;
        var areaTop = event.target.dataset.y;

        // Je pointe sur le marqueur dont l'identifiant corresponds à celui de la zone activée.
        var selectedMarker = this.template.querySelector(`[data-idx="${areaId}"]`);

        // Je calcule en pourcentage la position et la taille du Marker de la zone activée.
        var markerLeft = (parseFloat(areaLeft - this._markerResourceFinalWidth_px / 2) / this._mapWidth_px) * 100;
        var markerTop = (parseFloat(areaTop - this._markerResourceFinalHeight_px) / this._mapHeight_px) * 100;

        var markerWidth = (parseFloat(this._markerResourceFinalWidth_px) / this._mapWidth_px) * 100;
        /*var markerHeight = (parseFloat(this._markerResourceFinalHeight_px) / this._mapHeight_px) * 100;*/

        // Je positionne le Marker.
        selectedMarker.style.left = markerLeft.toString() + "%";
        selectedMarker.style.top = markerTop.toString() + "%";
        selectedMarker.style.width = markerWidth.toString() + "%";
        /*selectedMarker.style.height = markerHeight.toString() + "%";*/

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

            this.removeItemFromStack(areaId);
        } else {
            selectedMarker.classList.add('markerVisible');
            selectedMarker.classList.remove('markerHidden');
            this.appendItemToStack(selectedRegion);
        }
        this.omniUpdateDataJson(this._jsonDataStack, true);

    }

    async handleConfirmClick() {

        if (Array.isArray(this._jsonDataStack) && this._jsonDataStack.length > 0) {
            const result = await LightningConfirm.open({
                message: "Are you sure you want to continue?",
                variant: "default",
                theme: "warning",
                label: "Reset the Map"
            });

            //result is true if OK was clicked
            if (result) {
                this.clearMap();
                //this.handleSuccessAlertClick();
            } else {
                //and false if cancel was clicked
                //this.handleErrorAlertClick();
            }
        }

    }

    /**
     * PRIVATE FUNCTIONS SECTION
     */

    // Checking weither the selected item is in the stack, in order to remove it or not
    isItemCurrentlySelected(value) {
        if (value) {
            const item = this._jsonDataStack.filter(data => data.id == value);
            return !!item.length;
        }
    }

    // Adding selected item to the stack
    appendItemToStack(value) {
        if (value) {
            this._jsonDataStack.push(value);
        }
    }
    // Removing selected item from the Stack
    removeItemFromStack(value) {
        if (value) {
            this._jsonDataStack = this._jsonDataStack.filter(data => data.id != value);
        }
    }

    clearMap() {

        for (var r of this._regions) {
            var marker = this.template.querySelector(`[data-idx="${r.id}"]`);
            marker.classList.remove('markerVisible');
            marker.classList.add('markerHidden');
        }

        this._jsonDataStack = [];
        this.omniUpdateDataJson(this._jsonDataStack, true);
    }

    /*
    async handleSuccessAlertClick() {
        await LightningAlert.open({
            message: `You clicked "Ok"`,
            theme: "success",
            label: "Success!"
        });
    }

    async handleErrorAlertClick() {
        await LightningAlert.open({
            message: `You clicked "Cancel"`,
            theme: "error",
            label: "Error!"
        });
    }*/

}