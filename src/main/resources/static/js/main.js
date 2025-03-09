// import geoUtils
import { haversineDistance, areCoordinatesNear } from './geoUtils.js';

// Configure Cesiom
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxM2MyODI3Zi0yZGIzLTRlOTMtYjg3My0yOGMyYTYxM2U1NjAiLCJpZCI6MjYwODAzLCJpYXQiOjE3MzM3MDgyNjh9.FY-d2_kcOZ4zQOaNZL3_Ta1CFrnb7bB3Rn8C8jsHu3E';
const viewer = new Cesium.Viewer('cesiumContainer', {
    timeline:false,
    animation: false,
    skyBox: false,
    fullscreenButton: false,
    geocoder: false,
    homeButton: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    baseLayerPicker: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
    baseLayer: Cesium.ImageryLayer.fromProviderAsync(Cesium.ArcGisMapServerImageryProvider.fromUrl(
        "https://services.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer"
    )),
    contextOptions: {
        webgl: {
          antialias: true
        }
    },
});
viewer.resolutionScale = 2.0;

function addLayer(type) {
    const layer = type.slice(0, type.length-2);
    const tdtURL = `http://t{s}.tianditu.gov.cn/${type}/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=${layer}&STYLE=default&TILEMATRIXSET=w&FORMAT=tiles&TILEMATRIX={TileMatrix}&TILEROW={TileRow}&TILECOL={TileCol}&tk=931b431b7079480e40002c4de3b767b5`;
    const tdtProvider = new Cesium.WebMapTileServiceImageryProvider({
        url: tdtURL,
        layer: layer,
        style: "default",
        format: "tiles",
        tileMatrixSetID: "w",
        tilingScheme: new Cesium.WebMercatorTilingScheme(),
        subdomains: ["0", "1", "2", "3", "4", "5", "6", "7"],
        maximumLevel: 18,
        rectangle: Cesium.Rectangle.fromDegrees(-180, -85, 180, 85),
    });
    viewer.imageryLayers.addImageryProvider(tdtProvider);
}
addLayer("vec_w");
addLayer("cva_w");

const scene = viewer.scene;
const camera = viewer.camera;

// ajax parameters
const ajaxTimeout = 60 * 1000;
const baseURL = "http://101.6.8.175:22223/api/v1/servloc";
const ajaxMethod = "GET";
const ajaxDataType = "json";

// Primitive type
const PRIMTYPE = {
    PHYNODE: "PhyNode",
    CLUSTERNODE: "ClusterNode",
    SUBMARINECABLE: "SubmarineCable",
    LANDCABLE: "LandCable",
    LANDINGPOINT: "LandingPoint",
    LOGICNODE: "LogicNode",
    LOGICLINK: "LogicLink",
    POP: "PoP",
}

const InterConnType = {
    FACILITY: "FacilityInterConn",
    LANDCABLE: "LandCableInterConn",
    SUBMARINECABLE: "SubmarineCableInterConn",
}

// View Type
const VIEWTYPE = {
    LOGICAL: "Logical",
    PHYSICAL: "Physical",
}

// Sub View Type
const SUBVIEWTYPE = {
    GLOBAL: "Global",
    LOCAL: "Local",
}

const QUERYTYPE = {
    NONE: "None",
    SINGLE: "Single",
    TUPLE: "Tuple",
}

var tmpViewType = VIEWTYPE.LOGICAL;
var tmpSubViewType = SUBVIEWTYPE.GLOBAL;
var tmpQueryType = QUERYTYPE.NONE;
var tmpQuerySingleAS = undefined;
var tmpQueryASTuple = undefined;

// point collection
const physicalNodeHeight = 0;
const phyNodeMinPixelSize = 4, phyNodeMaxPixelSize = 4;
const phyNodeColor = Cesium.Color.CYAN;
const physicalNodeOutlineColor = Cesium.Color.BLACK, phyNodeOutlineWidth = 0.1;
const phyNodeMinScaleDist = 1e4, phyNodeMaxScaleDist = 8e6, phyNodeMinScaler = 1, phyNodeMaxScaler = 10;
const physicalNodeCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
const physicalNodeLabelCollection = scene.primitives.add(new Cesium.LabelCollection());
const phyNodeLabelVisMinDistance = 0, phyNodeLabelVisMaxDistance = 100000;

// cluster parameters
const clusterDistance = 100;

// sabmarine cable collection
const submarineCableLineWidth = 2;
const submarineCableColor = Cesium.Color.MIDNIGHTBLUE;
const submarineCableLineCollection = scene.primitives.add(new Cesium.PrimitiveCollection());

// land cable collection
const landCableLineWidth = 2;
const landCableColor = Cesium.Color.DARKORANGE;
const landCableLineCollection = scene.primitives.add(new Cesium.PrimitiveCollection());

// landing point collection
const landingPointHeight = 0, landingPointPixelSize = 4;
const landingPointColor = Cesium.Color.CORNSILK;
const landingPointOutlineColor = Cesium.Color.BLACK, landingPointOutlineWidth = 0.1;
const landingPointMinScaleDist = 1e4, landingPointMaxScaleDist = 8e6, landingPointMinScaler = 1, landingPointMaxScaler = 10;
const landingPointCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());

// logic node collection
const logicNodeHeight = 1e4;
const logicNodeCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
const minLogicNodePixelSize = 4, maxLogicNodePixelSize = 12;
const logicNodeOutlineWidth = 0, logicNodeOutlineColor = Cesium.Color.TRANSPARENT;
const tier1AS = [3356, 1299, 2914, 6762, 3257, 6453, 6461, 3491, 5511, 12956, 3320, 701, 7018, 6830];
const logicNodeMinScaleDist = 1e4, logicNodeMaxScaleDist = 8e6, logicNodeMinScaler = 1, logicNodeMaxScaler = 10;
var minGlobalConeSize = undefined, maxGlobalConeSize = undefined;
const tier1ASColor = Cesium.Color.fromCssColorString('#FDB863'), normalASColor = Cesium.Color.fromCssColorString('#B2DF8A'), targetASColor = Cesium.Color.fromCssColorString('#CAB2D6');

// logic link collection
const logicLinkCollection = scene.primitives.add(new Cesium.PrimitiveCollection());
const p2cLinkIndex = 0, p2pLinkIndex = 1;
const logicLinkHeight = 0;
const p2cLogicLinkColor = Cesium.Color.fromCssColorString('#1F78B4'), p2pLogicLinkColor = Cesium.Color.fromCssColorString('#8C564B');
const minLogicLinkLineWidth = 1, maxLogicLinkLineWidth = 2, p2cLogicLinkAlpha = 0.3, p2pLogicLinkAlpha = 0.15;

// local logic node collection
const localLogicNodeHeight = 1e4;
const localTargetLogicNodeCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
const localNbrLogicNodeCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
const minLocalLogicNodePixelSize = 4, maxLocalLogicNodePixelSize = 12;
const localLogicNodeOutlineWidth = 0, localLogicNodeOutlineColor = Cesium.Color.TRANSPARENT;
const localLogicNodeMinScaleDist = 1e4, localLogicNodeMaxScaleDist = 8e6, localLogicNodeMinScaler = 1, localLogicNodeMaxScaler = 10;
const localLogicNodeAlpha = 1;

// sub logic link collection
const localLogicLinkCollection = scene.primitives.add(new Cesium.PrimitiveCollection());
const localP2CLinkIndex = 0, localP2PLinkIndex = 1;
const localLogicLinkHeight = 0;
const localMinLogicLinkLineWidth = 1, localMaxLogicLinkLineWidth = 2;
const localP2CLogicLinkAlpha = 0.3, localP2PLogicLinkAlpha = 0.15;

// pop collection
const popCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
const popPixelSize = 8, popOutlineWidth = 0.1;
const popHeight = 100, facilityHeight = 1000;
const popMinScaleDist = 1e4, popMaxScaleDist = 8e6, popMinScaler = 1, popMaxScaler = 5;
const INTERSEC_PREC = 1e-3;
const popColors = [Cesium.Color.fromCssColorString('#FFA500'), Cesium.Color.fromCssColorString('#800080')]

// local physical node collection
const localPhysicalNodeCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
const localPhyNodePixelSize = 4;
const localPhyNodeHeight = 1000;
const localPhyNodeOutlineWidth = 0.1;
const localPhyNodeMinScaleDist = 1e4, localPhyNodeMaxScaleDist = 8e6, localPhyNodeMinScaler = 1, localPhyNodeMaxScaler = 5;

// local land cable collection
const localLandCableLineCollection = scene.primitives.add(new Cesium.PrimitiveCollection());
const localDirectLinkCollection = scene.primitives.add(new Cesium.PrimitiveCollection());
const localLandCableLineWidth = 2;
const localDirectLinkWidth = 2;

// local submarine cable collection
const localSubmarineCableLineCollection = scene.primitives.add(new Cesium.PrimitiveCollection());
const localSubmarineCableLineWidth = 2;

// local landing point collection
const localLandingPointCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
const localLandingPointPixelSize = 4, localLandingPointOutlineWidth = 0.5, localLandingPointHeight = 1000;
const localLandingPointMinScaleDist = 1e4, localLandingPointMaxScaleDist = 8e6, localLandingPointMinScaler = 1, localLandingPointMaxScaler = 5;

// hover parameter
const hoverAlpha = 1, unhoverAlpha = 0.5, hoverScaler = 3;
const landcableUnhoverAlpha = 0.1, submarinecableUnhoverAlpha = 0.3;
let hoverPhysicalNode = undefined, hoverSrcPoP = undefined, hoverDstPoP = undefined;
let hoverLandCableID = undefined;
let hoverSubmarineCableID = undefined, hoverSrcLandPoint = undefined, hoverDstLandPoint = undefined;

// tab view init timeout
const tabViewInitTimeout = 5000;

// flyHeight
const flyHeight = 2e7;

// center position and height
const centerLat = 34.28, centerLon = 86.11, centerHeight = 2e7;

// floating point precision
const PRECISION = 4;

class ObjectID {
    constructor(_id, _type) {
        this.id = _id;
        this.type = _type;
    }
}

class PhysicalNodeID extends ObjectID {
    constructor(_id, _type, _name, _organization, _latitude, _longitude, _city, _state, _country, _source, _date) {
        super(_id, _type);
        this.name = _name;
        this.organization = _organization;
        this.latitude = _latitude;
        this.longitude = _longitude;
        this.city = _city;
        this.state = _state;
        this.country = _country;
        this.source = _source;
        this.date = _date;
    }
}

class ClusterNodeID extends ObjectID {
    constructor(_id, _type, _name, _organization, _latitude, _longitude, _city, _state, _country, _source, _date) {
        super(_id, _type);
        this.organization = _organization;
        this.latitude = _latitude;
        this.longitude = _longitude;
        this.city = _city;
        this.state = _state;
        this.country = _country;
        this.source = _source;
        this.date = _date;
    }
}

class SubmarineCableID extends ObjectID {
    constructor(_id, _type, _name, _featureID, _source, _date, _subID) {
        super(_id, _type);
        this.name = _name;
        this.featureID = _featureID;
        this.source = _source;
        this.date = _date;
        this.subID = _subID;
    }
}

class LandCableID extends ObjectID {
    constructor(_id, _type, _from_city, _from_state, _from_country, _to_city, _to_state, _to_country, _distance, _date) {
        super(_id, _type);
        this.fromCity = _from_city;
        this.fromState = _from_state;
        this.fromCountry = _from_country;
        this.toCity = _to_city;
        this.toState = _to_state;
        this.toCountry = _to_country;
        this.distance = _distance;
        this.date = _date;
    }
}

class LandingPointID extends ObjectID {
    constructor(_id, _type, _city, _state, _country, _latitude, _longitude, _source, _date) {
        super(_id, _type);
        this.city = _city;
        this.state = _state;
        this.country = _country;
        this.latitude = _latitude;
        this.longitude = _longitude;
        this.source = _source;
        this.date = _date;
    }
}

class LogicNodeID extends ObjectID {
    constructor(_id, _type, _asn, _name, _organization) {
        super(_id, _type);
        this.asn = _asn;
        this.name = _name;
        this.organization = _organization;
    }
}

class LogicLinkID extends ObjectID {
    constructor(_id, _type, _src_idx, _dst_idx, _src_asn, _dst_asn, _link_type) {
        super(_id, _type);
        this.srcIdx = _src_idx;
        this.dstIdx = _dst_idx;
        this.srcAsn = _src_asn;
        this.dstAsn = _dst_asn;
        this.linkType = _link_type;
    }
}

class PoPID extends ObjectID {
    constructor(_id, _type, _asn, _latitude, _longitude, _facilityId, _cityId, _landingPointId, _distance) {
        super(_id, _type);
        this.asn = _asn;
        this.latitude = _latitude;
        this.longitude = _longitude;
        this.facilityId = _facilityId;
        this.cityId = _cityId;
        this.landingPointId = _landingPointId;
        this.distance = _distance;
    }
}

class InterConnID {
    constructor(_id, _type, _src_pop_idx, _dst_pop_idx, _src_asn, _dst_asn) {
        this.id = _id;
        this.type = _type;
        this.srcPopIdx = _src_pop_idx;
        this.dstPopIdx = _dst_pop_idx;
        this.srcAsn = _src_asn;
        this.dstAsn = _dst_asn;
    }
}

class FacilityInterConnID extends InterConnID {
    constructor(_id, _type, _src_pop_idx, _dst_pop_idx, _src_asn, _dst_asn, _name, _org, _city, _state, _country) {
        super(_id, _type, _src_pop_idx, _dst_pop_idx, _src_asn, _dst_asn);
        this.name = _name;
        this.org = _org;
        this.city = _city;
        this.state = _state;
        this.country = _country;
    }
}

class LandCableInterConnID extends InterConnID {
    constructor(_id, _type, _src_pop_idx, _dst_pop_idx, _src_asn, _dst_asn, _from_city, _from_state, _from_country, _to_city, _to_state, _to_country) {
        super(_id, _type, _src_pop_idx, _dst_pop_idx, _src_asn, _dst_asn);
        this.fromCity = _from_city;
        this.fromState = _from_state;
        this.fromCountry = _from_country;
        this.toCity = _to_city;
        this.toState = _to_state;
        this.toCountry = _to_country;
    }
}

class SubmarineCableInterConnID extends InterConnID {
    constructor(_id, _type, _src_pop_idx, _dst_pop_idx, _src_asn, _dst_asn, _src_ld_pts_idx, _dst_ld_pts_idx, _src_lp_name, _dst_lp_name, _seg_name) {
        super(_id, _type, _src_pop_idx, _dst_pop_idx, _src_asn, _dst_asn);
        this.srcLdPtsIdx = _src_ld_pts_idx;
        this.dstLdPtsIdx = _dst_ld_pts_idx;
        this.srcLpName = _src_lp_name;
        this.dstLpName = _dst_lp_name;
        this.segName = _seg_name;
    }
}

/** 
 * ajax wrapper for promise
 * @param {Object} options
 * @return {Promise}
*/
function ajaxPromise(options) {
    return new Promise((resolve, reject) => {
        $.ajax(options).done(resolve).fail(reject);
    });
}

/**
 * cluster physical nodes by distance
 * @param {Array} physicalNodeData
 * @return {Array} clusteredPositions
 */
function clustering(physicalNodeData)
{
    const clusteredPositions = [];
    const positions = physicalNodeData.map(dataItem => {
        return Cesium.Cartesian3.fromDegrees(dataItem.longitude, dataItem.latitude, physicalNodeHeight);
    });
    positions.forEach((position, index) => {
        let clustered = false;
        for (let i=0; i<clusteredPositions.length; i++) {
            const clusterPos = clusteredPositions[i];
            const distance = Cesium.Cartesian3.distance(position, clusterPos.position);
            if (distance < clusterDistance) {
                clusterPos.indices.push(index);
                clusterPos.count ++;
                clustered = true;
                break;
            }
        }
        if (!clustered) {
            clusteredPositions.push({position: position, count: 1, indices: [index]});
        }
    });
    return clusteredPositions;
}

/**
 * calculate logic node pixel size by its cone size
 * @param {number} coneSize 
 * @param {number} minPixelSize 
 * @param {number} maxPixelSize 
 * @param {number} minConeSize 
 * @param {number} maxConeSize 
 * @returns {number} pixelSize
 */
function calculateLogicNodePixelSize(coneSize, minPixelSize, maxPixelSize, minConeSize, maxConeSize) {
    return minPixelSize + parseInt((maxPixelSize - minPixelSize) * (coneSize - minConeSize) / (maxConeSize - minConeSize));
}

/**
 * generate n colors that are distinguishable to the naked eye using CIELAB color space
 * @param {number} n 
 * @returns {Array} colors
 */
function generateCielabColors(n) {
    const colors = [];
    for (let i = 0; i < n; i++) {
        const l = 70; // 亮度
        const a = Math.cos((i / n) * 2 * Math.PI) * 50;
        const b = Math.sin((i / n) * 2 * Math.PI) * 50;
        const color = chroma.lab(l, a, b).hex();
        colors.push(color);
    }
    return colors;
}

/**
 * generate n colors that are distinguishable to the naked eye using HSL color space
 * @param {number} n 
 * @returns {Array} colors
 */
function generateHSLColors(n) {
    const colors = [];
    const saturation = 70;
    const lightness = 50;
    for (let i = 0; i < n; i++) {
        const hue = (i * 360 / n) % 360;
        const color = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
        colors.push(color);
    }
    return colors;
}

/**
 * 
 * @param {number} lat 
 * @param {number} lon 
 * @returns 
 */
function coordnateOffset(lat, lng) {
    const KM_PER_DEGREE = 111, DISTANCE_RANGE = 5;
    const latPerturbationRange = DISTANCE_RANGE / KM_PER_DEGREE; // 约 0.045 度
    const latPerturbation = (Math.random() * 2 - 1) * latPerturbationRange;

    const lngPerturbationRange = DISTANCE_RANGE / (KM_PER_DEGREE * Math.cos((lat * Math.PI) / 180));
    const lngPerturbation = (Math.random() * 2 - 1) * lngPerturbationRange;
    
    const newLat = lat + latPerturbation;
    const newLng = lng + lngPerturbation;

    return [newLat, newLng];
}

/**
 * Get a coordinate around BaseCoord, with a given angle offset alpha and radius
 * @param {Object} BaseCoord 
 * @param {number} alpha 
 * @param {number} radius 
 * @returns {Object} newCoord
 */
function getPoPCoordinate(BaseCoord, alpha, radius) {
    const a = 6378137.0;
    const f = 1 / 298.257223563;
    const b = a * (1 - f);
    const alphaRad = (alpha * Math.PI) / 180;
    const latRad = (BaseCoord.latitude * Math.PI) / 180;
    const lonRad = (BaseCoord.longitude * Math.PI) / 180;
    const e2 = 1 - (b * b) / (a * a);
    const N = a / Math.sqrt(1 - e2 * Math.sin(latRad) * Math.sin(latRad));
    const newLatRad = latRad + (radius * Math.cos(alphaRad)) / N;
    const newLonRad = lonRad + (radius * Math.sin(alphaRad)) / (N * Math.cos(latRad));
    const newLat = (newLatRad * 180) / Math.PI;
    const newLon = (newLonRad * 180) / Math.PI;
    return {
        latitude: newLat,
        longitude: newLon
    };
}

/**
 * clear searchBox
 * @param
 * @return {void}
 */
function clearSearchArea() {
    document.getElementById('searchBox').value = "";
}

/**
 * disable checkBox by id
 * @param {string} id 
 * @param {string} state
 * @returns {void}
 */
function setCheckBoxState(id, state) {
    if (state === 'enable') {
        document.getElementById(id).disabled = false;
    }
    else if (state === 'disable') {
        document.getElementById(id).disabled = true;
    }
    else {
        document.getElementById(id).disabled = false;
    }
}

main();

/**
 * Entry point for the application
 * @param
 * @return {void}
 */
function main()
{
    loadPhysicalNodes();
    loadSubmarineCables();
    loadLandingPointCollection();
    loadLandCables();
    loadLogicNodes();
    loadLogicLinks();
    setupEventListener();
    setTimeout(initLogicalTabView, tabViewInitTimeout);
}

/**
 * local physical node info from server, cluster them by distance, create physicalNodeCollection and physicalNodeLabelCollection
 * @param 
 * @return {void}
 */
function loadPhysicalNodes()
{
    $.ajax({
        url: baseURL + "/physical-nodes/detail",
        method: ajaxMethod,
        timeout: ajaxTimeout,
        dataType: ajaxDataType
    }).done(function(response) {
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load physical nodes: " + message);
            return;
        }
        const clusters = clustering(data);
        const counts = clusters.map(cluster => cluster.count);
        const minCount = Math.min(...counts), maxCount = Math.max(...counts);
        clusters.forEach((cluster, cIndex) => {
            const position = cluster.position;
            const count = cluster.count;
            const indices = cluster.indices;
            const index = indices[0];
            const dataItem = data[index];
            const labelText = dataItem.name;

            let nodeID = undefined;
            if (count === 1) {
                nodeID = new PhysicalNodeID(dataItem.index, PRIMTYPE.PHYNODE, dataItem.name, dataItem.organization, dataItem.latitude, dataItem.longitude, dataItem.city, dataItem.state, dataItem.country, dataItem.source, dataItem.date);
            }
            else {
                nodeID = new ClusterNodeID(dataItem.index, PRIMTYPE.CLUSTERNODE, dataItem.name, dataItem.organization, dataItem.latitude, dataItem.longitude, dataItem.city, dataItem.state, dataItem.country, dataItem.source, dataItem.date);
            }
            physicalNodeCollection.add({
                id : nodeID,
                show : true,
                position : position,
                pixelSize : phyNodeMinPixelSize + (phyNodeMaxPixelSize - phyNodeMinPixelSize) * (count - minCount) / (maxCount - minCount),
                color : phyNodeColor,
                outlineColor : physicalNodeOutlineColor,
                outlineWidth : phyNodeOutlineWidth,
                scaleByDistance : new Cesium.NearFarScalar(phyNodeMinScaleDist, phyNodeMaxScaler, phyNodeMaxScaleDist, phyNodeMinScaler),
            })

            physicalNodeLabelCollection.add({
                show : true,
                position : position,
                text : labelText,
                font : '20pt sans-serif',
                fillColor : Cesium.Color.WHITE,
                outlineColor : Cesium.Color.BLACK,
                outlineWidth : 1.0,
                style : Cesium.LabelStyle.FILL_AND_OUTLINE,
                horizontalOrigin : Cesium.HorizontalOrigin.CENTER,
                verticalOrigin : Cesium.VerticalOrigin.TOP,
                distanceDisplayCondition : new Cesium.DistanceDisplayCondition(phyNodeLabelVisMinDistance, phyNodeLabelVisMaxDistance),
            });
        });
        physicalNodeCollection.show = false;
        physicalNodeLabelCollection.show = false;
    });
}



/**
 * load submarine cables from server, create submarineCableLineCollection
 * @param
 * @return {void}
 */
function loadSubmarineCables() {
    $.ajax({
        url: baseURL + "/submarine-cables/detail",
        method: ajaxMethod,
        timeout: ajaxTimeout,
        dataType: ajaxDataType
    }).done(function(response) {
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load submarine cables: " + message);
            return;
        }
        const cableInstances = [];
        for (let i=0; i<dataLength; i++) {
            const cable = data[i];
            const coordinates = cable.coordinates;
            try {
                coordinates.forEach((coordinate, index) => {
                    const cableDegrees = coordinate.flat();
                    const cablePositions = Cesium.Cartesian3.fromDegreesArray(cableDegrees);
                    const cableGeometry = new Cesium.GroundPolylineGeometry({
                        positions: cablePositions,
                        width: submarineCableLineWidth,
                    });
                    const cableInstance = new Cesium.GeometryInstance({
                        id: new SubmarineCableID(cable.id, PRIMTYPE.SUBMARINECABLE, cable.name, cable.feature_id, cable.source, cable.date, index),
                        geometry: cableGeometry,
                        attributes: {
                            color: Cesium.ColorGeometryInstanceAttribute.fromColor(submarineCableColor),
                        },
                    });
                    cableInstances.push(cableInstance);
                });
            }
            catch (error) {
                console.error("Failed to parse coordinates: " + error);
                return;
            }
        }
        submarineCableLineCollection.add(new Cesium.GroundPolylinePrimitive({
            geometryInstances: cableInstances,
            appearance: new Cesium.PolylineColorAppearance(),
        }));
        submarineCableLineCollection.show = false;
    });
}

/** 
 * load landing points from server, create landingPointCollection
 * @param
 * @return {void}
*/
function loadLandingPointCollection() {
    $.ajax({
        url: baseURL + "/landing-points/detail",
        method: ajaxMethod,
        timeout: ajaxTimeout,
        dataType: ajaxDataType
    }).done(function(response) {
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load landing points: " + message);
            return;
        }
        data.forEach(dataItem => {
            const position = Cesium.Cartesian3.fromDegrees(dataItem.longitude, dataItem.latitude, landingPointHeight);
            const pointID = new LandingPointID(dataItem.cable_id, PRIMTYPE.LANDINGPOINT, dataItem.city, dataItem.state, dataItem.country, dataItem.latitude, dataItem.longitude, dataItem.source, dataItem.date);
            landingPointCollection.add({
                id : pointID,
                position : position,
                pixelSize : landingPointPixelSize,
                color : landingPointColor,
                outlineColor : landingPointOutlineColor,
                outlineWidth : landingPointOutlineWidth,
                scaleByDistance: new Cesium.NearFarScalar(landingPointMinScaleDist, landingPointMaxScaler, landingPointMaxScaleDist, landingPointMinScaler),
            });
        });
        landingPointCollection.show = false;
    });
}

/**
 * load land cables from server, create landCableLineCollection
 * @param
 * @return {void}
 */
function loadLandCables() {
    $.ajax({
        url: baseURL + "/land-cables/detail",
        method: ajaxMethod,
        timeout: ajaxTimeout,
        dataType: ajaxDataType
    }).done(function(response) {
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load land cables: " + message);
            return;
        }
        const cableInstances = [];
        try {
            data.forEach(dataItem => {
                const coordinates = dataItem.coordinates;
                const cableDegrees = coordinates.flat();
                const cablePositions = Cesium.Cartesian3.fromDegreesArray(cableDegrees);
                const cableGeometry = new Cesium.GroundPolylineGeometry({
                    positions: cablePositions,
                    width: landCableLineWidth,
                });
                const cableInstance = new Cesium.GeometryInstance({
                    id: new LandCableID(dataItem.index, PRIMTYPE.LANDCABLE, dataItem.from_city, dataItem.from_state, dataItem.from_country, dataItem.to_city, dataItem.to_state, dataItem.to_country, dataItem.distance, dataItem.date),
                    geometry: cableGeometry,
                    attributes: {
                        color: Cesium.ColorGeometryInstanceAttribute.fromColor(landCableColor),
                        // color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.fromRandom({alpha: 1.0})),
                    },
                });
                cableInstances.push(cableInstance);
            });
            landCableLineCollection.add(new Cesium.GroundPolylinePrimitive({
                geometryInstances: cableInstances,
                appearance: new Cesium.PolylineColorAppearance(),
            }));
            landCableLineCollection.show = false;
        }
        catch (error) {
            console.error("Failed to parse coordinates: " + error);
            return;
        }
    });
}

/** 
 * load logic nodes from server, create logicNodeCollection
 * @param
 * @return {void}
*/
function loadLogicNodes() {
    $.ajax({
        url: baseURL + "/logic-nodes/detail",
        method: ajaxMethod,
        timeout: ajaxTimeout,
        dataType: ajaxDataType
    }).done(function(response) {
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load logical nodes: " + message);
            return;
        }

        const cone_sizes = data.map(dataItem => Math.log(dataItem.cone_size));
        const minConeSize = Math.min(...cone_sizes), maxConeSize = Math.max(...cone_sizes);
        minGlobalConeSize = minConeSize, maxGlobalConeSize = maxConeSize;

        data.forEach((dataItem, index) => {
            const position = Cesium.Cartesian3.fromDegrees(dataItem.longitude, dataItem.latitude, logicNodeHeight);
            const nodeID = new LogicNodeID(dataItem.index, PRIMTYPE.LOGICNODE, dataItem.asn, dataItem.name, dataItem.organization);
            const asn = dataItem.asn;
            const pixelSize = calculateLogicNodePixelSize(cone_sizes[index], minLogicNodePixelSize, maxLogicNodePixelSize, minConeSize, maxConeSize);
            const color = tier1AS.includes(asn) ? tier1ASColor : normalASColor;
            logicNodeCollection.add({
                id : nodeID,
                show : true,
                position : position,
                pixelSize : pixelSize,
                color : color,
                outlineColor : logicNodeOutlineColor,
                outlineWidth : logicNodeOutlineWidth,
                scaleByDistance: new Cesium.NearFarScalar(logicNodeMinScaleDist, logicNodeMaxScaler, logicNodeMaxScaleDist, logicNodeMinScaler),
            });
        });
        logicNodeCollection.show = false;
    });
}

/**
 * load logic links from server, create logicLinkCollection
 * @param
 * @return {void}
 */
function loadLogicLinks() {
    ajaxPromise({
        url: baseURL + "/logic-nodes/detail",
        method: ajaxMethod,
        timeout: ajaxTimeout,
        dataType: ajaxDataType
    }).then(function(response) {
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load logical nodes: " + message);
            return;
        }
        const asnArray = data.map(dataItem => dataItem.asn);
        const param = asnArray.join(",");
        return ajaxPromise({
            url: baseURL + "/logic-links/detail",
            method: ajaxMethod,
            data: {asns: param},
            timeout: ajaxTimeout,
            dataType: ajaxDataType
        });
    }).then(function(response) {
        const data = response.data, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load logical nodes: " + message);
            return;
        }
        const logicLinksArray = data;
        console.log("logicLinksArray: " + logicLinksArray.length);
        const p2cLogicLinkInstances = [], p2pLogicLinkInstances = [];
        logicLinksArray.forEach((dataItem, index) => {
            const srcIdx = dataItem.src_node_index, dstIdx = dataItem.dst_node_index, srcAsn = dataItem.src_asn, dstAsn = dataItem.dst_asn;
            const src_lat = dataItem.src_latitude, src_lon = dataItem.src_longitude, dst_lat = dataItem.dst_latitude, dst_lon = dataItem.dst_longitude;
            const linkType = dataItem.link_type;
            let width = undefined;
            if (tier1AS.includes(srcAsn) && tier1AS.includes(dstAsn)) {
                width = maxLogicLinkLineWidth;
            }
            else {
                width = minLogicLinkLineWidth;
            }
            const logicLinkInstances = (linkType === "p2c") ? p2cLogicLinkInstances : p2pLogicLinkInstances;
            logicLinkInstances.push(new Cesium.GeometryInstance({
                id: new LogicLinkID(dataItem.index, PRIMTYPE.LOGICLINK, srcIdx, dstIdx, srcAsn, dstAsn, linkType),
                geometry: new Cesium.PolylineGeometry({
                    vertexFormat : Cesium.VertexFormat.POSITION_ONLY,
                    positions: Cesium.Cartesian3.fromDegreesArrayHeights([src_lon, src_lat, logicLinkHeight, dst_lon, dst_lat, logicLinkHeight]),
                    width: width,
                }),
            }));
        });
        console.log("add");
        logicLinkCollection.add(new Cesium.Primitive({
            geometryInstances: p2cLogicLinkInstances,
            appearance: new Cesium.PolylineMaterialAppearance({
                translucent: true,
                material: Cesium.Material.fromType("Color", {
                    color: p2cLogicLinkColor.withAlpha(p2cLogicLinkAlpha),
                })
            }),
        }));
        logicLinkCollection.add(new Cesium.Primitive({
            geometryInstances: p2pLogicLinkInstances,
            appearance: new Cesium.PolylineMaterialAppearance({
                translucent: true,
                material: Cesium.Material.fromType("Color", {
                    color: p2pLogicLinkColor.withAlpha(p2pLogicLinkAlpha),
                })
            }),
        }));
        logicLinkCollection.get(p2cLinkIndex).show = false;
        logicLinkCollection.get(p2pLinkIndex).show = false;
    });
}

/** 
 * Pop up infobox when mouse move onto certain primitive
 * @param
 * @return {void}
*/
function setupMouseMoveEventListener() {

    function showInfoBox(content, x, y) {
        infoBox.innerHTML = content;
        infoBox.style.display = 'block';
        infoBox.style.left = x + 'px';
        infoBox.style.top = y + 'px';
    }

    function hideInfoBox() {
        infoBox.innerHTML = "";
        infoBox.style.display = 'none';
    }

    function recoverUnhoverState() {
        const hoverPointArray = [hoverPhysicalNode, hoverSrcPoP, hoverDstPoP, hoverSrcLandPoint, hoverDstLandPoint];
        hoverPointArray.forEach(hoverPoint => {
            if (hoverPoint !== undefined) {
                hoverPoint.pixelSize = hoverPoint.pixelSize / hoverScaler;
                hoverPoint.color = hoverPoint.color.withAlpha(unhoverAlpha);
            }
        });
        hoverPhysicalNode = undefined, hoverSrcPoP = undefined, hoverDstPoP = undefined, hoverSrcLandPoint = undefined, hoverDstLandPoint = undefined;

        if (hoverLandCableID !== undefined) {
            const attributes = localLandCableLineCollection.get(0).getGeometryInstanceAttributes(hoverLandCableID);
            let values = new Array();
            values.push(...attributes.color);
            values[3] = parseInt(landcableUnhoverAlpha * 255);
            attributes.color = values;
            hoverLandCableID = undefined;
        }

        if (hoverSubmarineCableID !== undefined) {
            const attributes = localSubmarineCableLineCollection.get(0).getGeometryInstanceAttributes(hoverSubmarineCableID);
            let values = new Array();
            values.push(...attributes.color);
            values[3] = parseInt(submarinecableUnhoverAlpha * 255);
            attributes.color = values;
            hoverSubmarineCableID = undefined;
        }
    }

    const infoBox = document.createElement('div');
    infoBox.style.position = 'absolute';
    infoBox.style.color = 'white';
    infoBox.style.font = '14px sans-serif';
    infoBox.style.opacity = '0.8';
    infoBox.style.backgroundColor = 'black';
    infoBox.style.padding = '5px';
    infoBox.style.borderRadius = '5px';
    infoBox.style.border = '1px solid whilte';
    infoBox.style.display = 'none';
    document.body.appendChild(infoBox);

    const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    // ScreenSpaceEventHandler.MotionEventCallback
    handler.setInputAction(function(movement) {
        const pickedObject = viewer.scene.pick(movement.endPosition); // movement: Cesium.ScreenSpaceEventHandler.MotionEvent
        let content = undefined;
        if (tmpViewType === VIEWTYPE.LOGICAL || tmpSubViewType === SUBVIEWTYPE.GLOBAL || (tmpViewType === VIEWTYPE.PHYSICAL && tmpQueryType === QUERYTYPE.SINGLE)) {
            if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
                switch(pickedObject.id.type) {
                    case PRIMTYPE.PHYNODE:
                        content = "<p>Facility: " + pickedObject.id.name + "<br>Organization: " + pickedObject.id.organization + "<br>City: " + pickedObject.id.city + "<br>State: " + pickedObject.id.state + "<br>Country: " + pickedObject.id.country + "</p>";
                        showInfoBox(content, movement.endPosition.x, movement.endPosition.y);
                        break;
                    case PRIMTYPE.CLUSTERNODE:
                        content = "<p>Facility: " + pickedObject.id.name + "<br>Organization: " + pickedObject.id.organization + "<br>City: " + pickedObject.id.city + "<br>State: " + pickedObject.id.state + "<br>Country: " + pickedObject.id.country + "</p>";
                        showInfoBox(content, movement.endPosition.x, movement.endPosition.y);
                        break;
                    case PRIMTYPE.SUBMARINECABLE:
                        content = "<p>Submarine Cable: " + pickedObject.id.name + "<br>Feature ID: " + pickedObject.id.featureID + "</p>";
                        showInfoBox(content, movement.endPosition.x, movement.endPosition.y);
                        break;
                    case PRIMTYPE.LANDCABLE:
                        content = "<p>From: " + pickedObject.id.fromCity + ", " + pickedObject.id.fromState + ", " + pickedObject.id.fromCountry + "<br>To: " + pickedObject.id.toCity + ", " + pickedObject.id.toState + ", " + pickedObject.id.toCountry + "<br>Distance: " + pickedObject.id.distance + "</p>";
                        showInfoBox(content, movement.endPosition.x, movement.endPosition.y);
                        break;
                    case PRIMTYPE.LANDINGPOINT:
                        content = "<p>Landing Point: " + pickedObject.id.id + "<br>City: " + pickedObject.id.city + "<br>State: " + pickedObject.id.state + "<br>Country: " + pickedObject.id.country + "</p>";
                        showInfoBox(content, movement.endPosition.x, movement.endPosition.y);
                        break;
                    case PRIMTYPE.LOGICNODE:
                        content = "<p>ASN:" + pickedObject.id.asn + "<br>Name: " + pickedObject.id.name + "<br>Organization: " + pickedObject.id.organization + "</p>";
                        showInfoBox(content, movement.endPosition.x, movement.endPosition.y);
                        break;
                    case PRIMTYPE.LOGICLINK:
                        content = "<p>SRC: AS" + pickedObject.id.srcAsn + "<br>DST: AS" + pickedObject.id.dstAsn + "<br>Link Type: " + pickedObject.id.linkType + "</p>";
                        showInfoBox(content, movement.endPosition.x, movement.endPosition.y);
                        break;
                    case PRIMTYPE.POP:
                        content = "<p>ASN: " + pickedObject.id.asn + "<br>latitude: " + pickedObject.id.latitude + "<br>longitude: " + pickedObject.id.longitude + "</p>";
                        showInfoBox(content, movement.endPosition.x, movement.endPosition.y);
                        break;
                    default:
                        break;
                }
            } else {
                hideInfoBox();
            }
        }
        else {
            if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
                recoverUnhoverState();
                switch(pickedObject.id.type) {
                    case InterConnType.FACILITY:
                        const currentPhysicalNode = pickedObject.primitive;
                        if (currentPhysicalNode !== hoverPhysicalNode) {
                            const hoverPointArray = [hoverPhysicalNode, hoverSrcPoP, hoverDstPoP];
                            hoverPointArray.forEach(hoverPoint => {
                                if (hoverPoint !== undefined) {
                                    hoverPoint.pixelSize = hoverPoint.pixelSize / hoverScaler;
                                    hoverPoint.color = hoverPoint.color.withAlpha(unhoverAlpha);
                                }
                            });
                            hoverPhysicalNode = currentPhysicalNode;
                            hoverSrcPoP = popCollection.get(pickedObject.id.srcPopIdx);
                            hoverDstPoP = popCollection.get(pickedObject.id.dstPopIdx);
                            const _hoverPointArray = [hoverPhysicalNode, hoverSrcPoP, hoverDstPoP];
                            _hoverPointArray.forEach(hoverPoint => {
                                hoverPoint.pixelSize = hoverPoint.pixelSize * hoverScaler;
                                hoverPoint.color = hoverPoint.color.withAlpha(hoverAlpha);
                            });
                            content = "<p>Facility: " + pickedObject.id.name + "<br>Organization: " + pickedObject.id.org + "<br>City: " + pickedObject.id.city + "<br>State: " + pickedObject.id.state + "<br>Country: " + pickedObject.id.country + "</p>";
                            showInfoBox(content, movement.endPosition.x, movement.endPosition.y);
                        }
                        break;
                    case InterConnType.LANDCABLE:
                        if (pickedObject.id !== hoverLandCableID) {
                            const attributes = localLandCableLineCollection.get(0).getGeometryInstanceAttributes(hoverLandCableID);
                            if (attributes !== undefined) {
                                let values = new Array();
                                values.push(...attributes.color);
                                values[3] = parseInt(landcableUnhoverAlpha * 255);
                                attributes.color = values;
                                const hoverPointArray = [hoverSrcPoP, hoverDstPoP];
                                hoverPointArray.forEach(hoverPoint => {
                                    if (hoverPoint !== undefined) {
                                        hoverPoint.pixelSize = hoverPoint.pixelSize / hoverScaler;
                                        hoverPoint.color = hoverPoint.color.withAlpha(unhoverAlpha);
                                    }
                                });
                            }
                            hoverLandCableID = pickedObject.id;
                            const _attributes = localLandCableLineCollection.get(0).getGeometryInstanceAttributes(hoverLandCableID);
                            let values = new Array();
                            values.push(..._attributes.color);
                            values[3] = parseInt(hoverAlpha * 255);
                            _attributes.color = values;
                            hoverSrcPoP = popCollection.get(pickedObject.id.srcPopIdx);
                            hoverDstPoP = popCollection.get(pickedObject.id.dstPopIdx);
                            const _hoverPointArray = [hoverSrcPoP, hoverDstPoP];
                            _hoverPointArray.forEach(hoverPoint => {
                                if (hoverPoint !== undefined) {
                                    hoverPoint.pixelSize = hoverPoint.pixelSize * hoverScaler;
                                    hoverPoint.color = hoverPoint.color.withAlpha(hoverAlpha);
                                }
                            });
                            content = "<p>From: " + pickedObject.id.fromCity + ", " + pickedObject.id.fromState + ", " + pickedObject.id.fromCountry + "<br>To: " + pickedObject.id.toCity + ", " + pickedObject.id.toState + ", " + pickedObject.id.toCountry + "<br>Type: Landcable" + "</p>";
                            showInfoBox(content, movement.endPosition.x, movement.endPosition.y);
                        }
                        break;
                    case InterConnType.SUBMARINECABLE:
                        if (pickedObject.id !== hoverSubmarineCableID) {
                            const attributes = localSubmarineCableLineCollection.get(0).getGeometryInstanceAttributes(hoverSubmarineCableID);
                            if (attributes !== undefined) {
                                let values = new Array();
                                values.push(...attributes.color);
                                values[3] = parseInt(submarinecableUnhoverAlpha * 255);
                                attributes.color = values;
                            }
                            const hoverPointArray = [hoverSrcPoP, hoverDstPoP];
                            hoverPointArray.forEach(hoverPoint => {
                                if (hoverPoint !== undefined) {
                                    hoverPoint.pixelSize = hoverPoint.pixelSize / hoverScaler;
                                    hoverPoint.color = hoverPoint.color.withAlpha(unhoverAlpha);
                                }
                            });
                            const landingPointArray = [hoverSrcLandPoint, hoverDstLandPoint];
                            landingPointArray.forEach(landingPoint => {
                                if (landingPoint !== undefined) {
                                    landingPoint.pixelSize = landingPoint.pixelSize / hoverScaler;
                                    landingPoint.color = landingPoint.color.withAlpha(unhoverAlpha);
                                }
                            });
                            hoverSubmarineCableID = pickedObject.id;
                            const _attributes = localSubmarineCableLineCollection.get(0).getGeometryInstanceAttributes(hoverSubmarineCableID);
                            let values = new Array();
                            values.push(..._attributes.color);
                            values[3] = parseInt(hoverAlpha * 255);
                            _attributes.color = values;
                            hoverSrcPoP = popCollection.get(pickedObject.id.srcPopIdx);
                            hoverDstPoP = popCollection.get(pickedObject.id.dstPopIdx);
                            const _hoverPointArray = [hoverSrcPoP, hoverDstPoP];
                            _hoverPointArray.forEach(hoverPoint => {
                                if (hoverPoint !== undefined) {
                                    hoverPoint.pixelSize = hoverPoint.pixelSize * hoverScaler;
                                    hoverPoint.color = hoverPoint.color.withAlpha(hoverAlpha);
                                }
                            });
                            hoverSrcLandPoint = localLandingPointCollection.get(pickedObject.id.srcLdPtsIdx);
                            hoverDstLandPoint = localLandingPointCollection.get(pickedObject.id.dstLdPtsIdx);
                            const _landingPointArray = [hoverSrcLandPoint, hoverDstLandPoint];
                            _landingPointArray.forEach(landingPoint => {
                                if (landingPoint !== undefined) {
                                    landingPoint.pixelSize = landingPoint.pixelSize * hoverScaler;
                                    landingPoint.color = landingPoint.color.withAlpha(hoverAlpha);
                                }
                            });
                            content = "<p>Landing Point 1: " + pickedObject.id.srcLpName + "<br>Landing Point 2: " + pickedObject.id.dstLpName + "<br>Cable: " + pickedObject.id.segName + "<br>Type: Submarinecable" + "</p>";
                            showInfoBox(content, movement.endPosition.x, movement.endPosition.y);
                        }
                        break;
                    default:
                        break;
                }
            } else {
                recoverUnhoverState();
                hideInfoBox();
            }
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
}

/**
 * Entry point for event handler setup
 * @param
 * @return {void}
 */
function setupEventListener() {
    setupMouseMoveEventListener();
    setupSlidingBarCloseEventListerer();
    setupQueryEventListener();
    setupTabEventListener();
    setupToggleEventListener();
}

/**
 * Set up listener to control the visibility of logic node collection under different sub view type
 * @param 
 * @return {void}
 */
function logicNodeToggleController() {
    let asCheckBox = document.getElementById("as-checkbox");
    asCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                logicNodeCollection.show = (event.target.checked)?true:false;
                break;
            case SUBVIEWTYPE.LOCAL:
                localNbrLogicNodeCollection.show = (event.target.checked)?true:false;
                break;
            default:
                break;
        }
    });
}

/**
 * Set up listener to control the visibility of p2p link collection under different sub view type
 * @param
 * @return {void}
 */
function p2pLinksToggleController() {
    let p2pCheckBox = document.getElementById("p2p-checkbox");
    p2pCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                logicLinkCollection.get(p2pLinkIndex).show = (event.target.checked)?true:false;
                break;
            case SUBVIEWTYPE.LOCAL:
                localLogicLinkCollection.get(localP2PLinkIndex).show = (event.target.checked)?true:false;
                break;
            default:
                break;
        }
    });
}

/**
 * Set up listener to control the visibility of p2c link collection under different sub view type
 * @param
 * @return {void}
 */
function p2cLinksToggleController() {
    let p2cCheckBox = document.getElementById("p2c-checkbox");
    p2cCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                logicLinkCollection.get(p2cLinkIndex).show = (event.target.checked)?true:false;
                break;
            case SUBVIEWTYPE.LOCAL:
                localLogicLinkCollection.get(localP2CLinkIndex).show = (event.target.checked)?true:false;
                break;
            default:
                break;
        }
    });
}

/**
 * Set up listener to control the visibility of physical node collection under different sub view type
 * @param
 * @return {void}
 */
function physicalNodeToggleController() {
    let facilityCheckBox = document.getElementById("facility-checkbox");
    facilityCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                physicalNodeCollection.show = (event.target.checked) ? true : false;
                physicalNodeLabelCollection.show = (event.target.checked) ? true : false;
                break;
            case SUBVIEWTYPE.LOCAL:
                localPhysicalNodeCollection.show = (event.target.checked) ? true : false;
                break;
            default:
                break;
        }
    });
}

/**
 * Set up listener to control the visibility of submarine cable collection under different sub view type
 * @param
 * @return {void}
 */
function submarineCableToggleController() {
    let subCableCheckBox = document.getElementById("submarine-cable-checkbox");
    subCableCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                submarineCableLineCollection.show = (event.target.checked)?true:false;
                break;
            case SUBVIEWTYPE.LOCAL:
                localSubmarineCableLineCollection.show = (event.target.checked)?true:false;
                break;
            default:
                break;
        }
    });
}

/**
 * Set up listener to control the visibility of landing point collection under different sub view type
 * @param
 * @return {void}
 */
function landingPointToggleController() {
    let landingPointCheckBox = document.getElementById("landing-points-checkbox");
    landingPointCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                landingPointCollection.show = (event.target.checked)?true:false;
                break;
            case SUBVIEWTYPE.LOCAL:
                // Todo: landing point local view
                // landingPointCollection.show = (event.target.checked)?true:false;
                localLandingPointCollection.show = (event.target.checked)?true:false;
                break;
            default:
                break;
        }
    });
}

/**
 * Set up listener to control the visibility of land cable collection under different sub view type
 * @param
 * @return {void}
 */
function landCableToggleController() {
    let landCableCheckBox = document.getElementById("long-haul-cable-checkbox");
    landCableCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                landCableLineCollection.show = (event.target.checked)?true:false;
                break;
            case SUBVIEWTYPE.LOCAL:
                // Todo: land cable local view
                localDirectLinkCollection.show = (event.target.checked)?true:false;
                localLandCableLineCollection.show = (event.target.checked)?true:false;
                break;
            default:
                break;
        }
    });
}

/**
 * Entry point for toggle controller setup
 * @param
 * @return {void}
 */
function setupToggleEventListener() {
    logicNodeToggleController();
    p2cLinksToggleController();
    p2pLinksToggleController();
    physicalNodeToggleController();
    submarineCableToggleController();
    landingPointToggleController();
    landCableToggleController();
}

/**
 * Close sliding bar that is open
 * @param
 * @return {void}
 */
function closeSlidingBar() {
    const slidingBarIds = ['slidingbar', 'slidingbar2', 'slidingbar3', 'slidingbar4'];
    const closeButtonIds = ['closeSlidingbar', 'closeSlidingbar2', 'closeSlidingbar3', 'closeSlidingbar4'];
    closeButtonIds.forEach((id, index) => {
        const slidingBar = document.getElementById(slidingBarIds[index]);
        // const closeSlidingbarBtn = document.getElementById(id);
        if (slidingBar.classList.contains('open')) { slidingBar.classList.remove('open'); }
    });

    document.getElementById('as-checkbox-span').textContent = "AS";

    setCheckBoxState("submarine-cable-checkbox", "enable");
    setCheckBoxState("landing-points-checkbox", "enable");
    setCheckBoxState("long-haul-cable-checkbox", "enable");
    
    closeLegend();
}

/**
 * Clear primitive collection for local view, close sliding bar
 * @param
 * @return {void}
 */
function clearLocalView() {

    closeSlidingBar();

    localNbrLogicNodeCollection.removeAll();
    localNbrLogicNodeCollection.show = false;

    localTargetLogicNodeCollection.removeAll();
    localTargetLogicNodeCollection.show = false;

    localLogicLinkCollection.removeAll();
    localLogicLinkCollection.show = false;

    popCollection.removeAll();
    popCollection.show = false;

    localPhysicalNodeCollection.removeAll();
    localPhysicalNodeCollection.show = false;
    
    localLandCableLineCollection.show = false;
    localLandCableLineCollection.removeAll();

    localDirectLinkCollection.show = false;
    localDirectLinkCollection.removeAll();

    localLandingPointCollection.show = false;
    localLandingPointCollection.removeAll();

    localSubmarineCableLineCollection.show = false;
    localSubmarineCableLineCollection.removeAll();
}

/**
 * Find toggle element by id, set its checked state and trigger change event
 * @param {string} toggleId 
 * @param {boolean} isChecked 
 */
function setToggleState(toggleId, isChecked) {
    const toggle = document.getElementById(toggleId);
      if (toggle) {
        // set checked state
        toggle.checked = isChecked;

        // trigger change event
        const event = new Event('change', { bubbles: true });
        toggle.dispatchEvent(event);
      }
}

/**
 * display logical view, set toggle state of items (as, p2p links, p2c links)
 * @param
 * @return {void}
 * Todo: switch view and subview according to tmpQueryType
 */
function logicalTabController() {
    tmpViewType = VIEWTYPE.LOGICAL;
    clearLocalView();

    switch(tmpSubViewType) {
        case SUBVIEWTYPE.GLOBAL:
            showLegend("普通AS", "Tier-1 AS", normalASColor.toCssColorString(), tier1ASColor.toCssColorString());
            break;
        case SUBVIEWTYPE.LOCAL:
            switch(tmpQueryType) {
                case QUERYTYPE.SINGLE:
                    querySingleASLogic(tmpQuerySingleAS);
                    break;
                case QUERYTYPE.TUPLE:
                    queryASTupleLogic(tmpQueryASTuple.asn1, tmpQueryASTuple.asn2);
                    break;
                default:
                    break;
            }
            break;
        default:
            break;
    }

    setToggleState("as-checkbox", true);
    setToggleState("p2p-checkbox", false);
    setToggleState("p2c-checkbox", false);
    setToggleState("facility-checkbox", false);
    setToggleState("submarine-cable-checkbox", false);
    setToggleState("landing-points-checkbox", false);
    setToggleState("long-haul-cable-checkbox", false);
    camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, centerHeight),
    });
}

/**
 * display physical view, set toggle state of items (facility, submarine cables, landing points, land cables)
 * @param
 * @return {void}
 * Todo: switch view and subview according to tmpQueryType
 */
function physicalTabController() {
    tmpViewType = VIEWTYPE.PHYSICAL;
    clearLocalView();

    switch(tmpSubViewType) {
        case SUBVIEWTYPE.GLOBAL:
            break;C
        case SUBVIEWTYPE.LOCAL:
            switch(tmpQueryType) {
                case QUERYTYPE.SINGLE:
                    querySingleASPhysical(tmpQuerySingleAS);
                    break;
                case QUERYTYPE.TUPLE:
                    queryASTuplePhysical(tmpQueryASTuple.asn1, tmpQueryASTuple.asn2);
                    break;
                default:
                    break;
            }
            break;
        default:
            break;
    }

    setToggleState("as-checkbox", false);
    setToggleState("p2p-checkbox", false);
    setToggleState("p2c-checkbox", false);
    setToggleState("facility-checkbox", true);
    setToggleState("submarine-cable-checkbox", true);
    setToggleState("landing-points-checkbox", true);
    setToggleState("long-haul-cable-checkbox", false);
    camera.flyTo({
        destination: Cesium.Cartesian3.fromDegrees(centerLon, centerLat, centerHeight),
    });
}

/**
 * Set up event listener for tab button click, which controlls switching view type and sub view type
 * @param
 * @return {void}
 * Todo: switch view and subview according to tmpQueryType
 */
function setupTabEventListener() {
    const tabButtons = document.querySelectorAll('.tab-button');
    const tabContents = document.querySelectorAll('.tab-content');

    tabButtons.forEach(button => {
        button.addEventListener('click', () => {
            // remove active class from all buttons and contents
            tabButtons.forEach(btn => btn.classList.remove('active'));
            tabContents.forEach(content => content.classList.remove('active'));

            // add active class to the clicked button and content
            const targetTab = button.getAttribute('data-tab');
            button.classList.add('active');
            document.getElementById(targetTab).classList.add('active');

            switch(targetTab) {
                case "logical":
                    logicalTabController();
                    break;
                case "physical":
                    physicalTabController();
                    break;
                default:
                    break;
            }
        });
    });
}

/**
 * init global logical tab view
 * @param
 * @return {void}
 * Todo: set view type, sub view type and query type
 */
function initLogicalTabView() {
    tmpViewType = VIEWTYPE.LOGICAL;
    tmpSubViewType = SUBVIEWTYPE.GLOBAL;
    tmpQueryType = QUERYTYPE.NONE;
    tmpQuerySingleAS = undefined;
    tmpQueryASTuple = undefined;
    let button = document.getElementById("logical-button");
    const event = new Event('click', { bubbles: true });
    button.dispatchEvent(event);
}

/**
 * init global physical tab view
 * @param
 * @return {void}
 * Todo: set view type, sub view type and query type
 */
function initPhysicalTabView() {
    tmpViewType = VIEWTYPE.PHYSICAL;
    tmpSubViewType = SUBVIEWTYPE.GLOBAL;
    tmpQueryType = QUERYTYPE.NONE;
    tmpQuerySingleAS = undefined;
    tmpQueryASTuple = undefined;
    let button = document.getElementById("physical-button");
    const event = new Event('click', { bubbles: true });
    button.dispatchEvent(event);
}

/**
 * Set up event listener for searchBox, press Enter to check format and start query.
 * @param
 * @return {void}
 */
function setupQueryEventListener() {
    $('#searchBox').on('keypress', function(e) {
        if (e.which === 13) {
            var input = $(this).val().trim();
            if (input.includes('-')) {
                var regex = /^AS\d+-AS\d+$/; // regular expression：AS[number]-AS[number]
                if (regex.test(input)) {
                    var asns = input.split('-');
                    var asn1 = parseInt(asns[0].replace("AS", ""), 10);
                    var asn2 = parseInt(asns[1].replace("AS", ""), 10);
                    if (isNaN(asn1) || isNaN(asn2)) {
                        alert("Invalid input: " + input + ". Please input like this: AS3356-AS1299.");
                        clearSearchArea();
                        return;
                    }
                    queryASTuple(asn1, asn2);
                }
                else {
                    alert("Invalid input: " + input + ". Please input like this: AS3356-AS1299.");
                    clearSearchArea();
                }
            }
            else {
                var regex = /^AS\d+$/; // regular expression：AS[number]
                if (regex.test(input)) {
                    var asn = parseInt(input.replace("AS", ""), 10);
                    if (isNaN(asn)) {
                        alert("Invalid input: " + input + ". Please input like this: AS3356.");
                        clearSearchArea();
                        return;
                    }
                    querySingleAS(asn);
                }
                else {
                    alert("Invalid input: " + input + ". Please input like this: AS3356.");
                    clearSearchArea();
                }
            }
        }
    });
}

/**
 * Entry point for query single AS
 * @param {number} asn 
 */
function querySingleAS(asn) {
    switch(tmpViewType) {
        case VIEWTYPE.LOGICAL:
            querySingleASLogic(asn);
            break;
        case VIEWTYPE.PHYSICAL:
            querySingleASPhysical(asn);
            break;
        default:
            break;
    }
}

/**
 * Entry point for query AS Tuple
 * @param {number} asn1 
 * @param {number} asn2 
 */
function queryASTuple(asn1, asn2) {
    switch(tmpViewType) {
        case VIEWTYPE.LOGICAL:
            queryASTupleLogic(asn1, asn2);
            break;
        case VIEWTYPE.PHYSICAL:
            queryASTuplePhysical(asn1, asn2);
            break;
        default:
            break;
    }
}

/**
 * Set up event listener for close button of sliding bar
 * @param
 * @return {void}
 */
function setupSlidingBarCloseEventListerer() {
    setupSingleASLogicSlidingBarCloseEventListener();
    setupSingleASPhysicalSlidingBarCloseEventListener();
    setupASTupleLogicSlidingBarCloseEventListener();
    setupASTuplePhysicalSlidingBarCloseEventListener();
}

/**
 * Set up event listener for close button of single-AS-logical-view mode sliding bar
 * @param
 * @return {void} 
 */
function setupSingleASLogicSlidingBarCloseEventListener() {
    const closeSlidingbarBtn = document.getElementById('closeSlidingbar');
    closeSlidingbarBtn.addEventListener('click', () => {
        const slidingbar = document.getElementById('slidingbar');
        slidingbar.classList.remove('open');
        localTargetLogicNodeCollection.removeAll();
        localNbrLogicNodeCollection.removeAll();
        localLogicLinkCollection.removeAll();
        localTargetLogicNodeCollection.show = false;
        localNbrLogicNodeCollection.show = false;
        localLogicLinkCollection.show = false;
        tmpSubViewType = SUBVIEWTYPE.GLOBAL;
        tmpQueryType = QUERYTYPE.NONE;
        tmpQuerySingleAS = undefined;
        tmpQueryASTuple = undefined;
        document.getElementById('as-checkbox-span').textContent = "AS";
        clearSearchArea();
        initLogicalTabView();
    });
}

/**
 * query single AS, show its logical view and sliding bar
 * @param {number} asn
 * @return {void} 
 */
function querySingleASLogic(asn) {

    function setSingleASLogicSlidingBarBaseInfo(_title, _asn, _name, _organization, _country, _cone_size, _cone_prefix_size, _degree_provider, _degree_peer, _degree_customer, _prefix_size) {
        const slidingbarTitle = document.querySelector('.slidingbar-title');
        const asn = document.getElementById('asn');
        const name = document.getElementById('name');
        const organization = document.getElementById('organization');
        const region = document.getElementById('region');
        const coneSize = document.getElementById('coneSize');
        const conePrefixSize = document.getElementById('conePrefixSize');
        const nbProvider = document.getElementById('nbProvider');
        const nbPeer = document.getElementById('nbPeer');
        const nbCustomer = document.getElementById('nbCustomer');
        const prefixSize = document.getElementById('prefixSize');
    
        slidingbarTitle.textContent = _title;
        asn.textContent = "" + _asn;
        name.textContent = _name;
        organization.textContent = _organization;
        region.textContent = _country;
        coneSize.textContent = _cone_size;
        conePrefixSize.textContent = _cone_prefix_size;
        nbProvider.textContent = _degree_provider;
        nbPeer.textContent = _degree_peer;
        nbCustomer.textContent = _degree_customer;
        prefixSize.textContent = _prefix_size;
    }
    
    function setSingleASLogicSlidingBarNbrList(neighborListData) {
        const neighborList = document.getElementById('neighborList');
        neighborList.innerHTML = ''; // 清空列表
        neighborListData.forEach((neighbor, index) => {
            const neighborItem = document.createElement('div');
            neighborItem.className = 'neighbor-item';
            neighborItem.textContent = `${index + 1}. ASN: ${neighbor.asn}, Relationship: ${neighbor.relationship}`;
            neighborList.appendChild(neighborItem);
        });
    }
    
    function showSpecificASLogicSlidingBar() {
        const slidingbar = document.getElementById('slidingbar');
        slidingbar.classList.add('open');
    }

    function addSingleNode(index, asn, name, organization, latitude, longitude, cone_size, isSearchTarget) {
        let pixelSize = undefined, color = undefined;
        if (isSearchTarget) {
            color = targetASColor;
        }
        else {
            color = tier1AS.includes(asn) ? tier1ASColor : normalASColor;
        }
        pixelSize = calculateLogicNodePixelSize(Math.log(cone_size), minLocalLogicNodePixelSize, maxLocalLogicNodePixelSize, minGlobalConeSize, maxGlobalConeSize);
        if (!isSearchTarget) {
            localNbrLogicNodeCollection.add({
                id : new LogicNodeID(index, PRIMTYPE.LOGICNODE, asn, name, organization),
                position : Cesium.Cartesian3.fromDegrees(longitude, latitude, localLogicNodeHeight),
                pixelSize : pixelSize,
                color : Cesium.Color.fromAlpha(color, localLogicNodeAlpha),
                outlineColor : Cesium.Color.fromAlpha(localLogicNodeOutlineColor, localLogicNodeAlpha),
                outlineWidth : localLogicNodeOutlineWidth,
                scaleByDistance: new Cesium.NearFarScalar(localLogicNodeMinScaleDist, localLogicNodeMaxScaler, localLogicNodeMaxScaleDist, localLogicNodeMinScaler),
            });
        }
        else {
            localTargetLogicNodeCollection.add({
                id : new LogicNodeID(index, PRIMTYPE.LOGICNODE, asn, name, organization),
                position : Cesium.Cartesian3.fromDegrees(longitude, latitude, localLogicNodeHeight),
                pixelSize : pixelSize,
                color : color,
                outlineColor : localLogicNodeOutlineColor,
                outlineWidth : localLogicNodeOutlineWidth,
                scaleByDistance: new Cesium.NearFarScalar(localLogicNodeMinScaleDist, localLogicNodeMaxScaler, localLogicNodeMaxScaleDist, localLogicNodeMinScaler),
            });
        }
    }

    closeSlidingBar();
    tmpSubViewType = SUBVIEWTYPE.LOCAL;
    tmpQueryType = QUERYTYPE.SINGLE;
    tmpQuerySingleAS = asn;
    logicNodeCollection.show = false;
    logicLinkCollection.get(p2cLinkIndex).show = false;
    logicLinkCollection.get(p2pLinkIndex).show = false;
    localLogicLinkCollection.removeAll();
    localNbrLogicNodeCollection.removeAll();
    localTargetLogicNodeCollection.removeAll();
    const neighborListData = [];

    ajaxPromise({
        url: baseURL + "/logic-nodes/detail",
        method: ajaxMethod,
        data: {asns: asn},
        timeout: ajaxTimeout,
        dataType: ajaxDataType
    }).then(function(response) {
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load logical nodes: " + message);
            return;
        }
        if (dataLength === 0) {
            alert("No data found for ASN: " + asn);
            return;
        }
        addSingleNode(data[0].index, data[0].asn, data[0].name, data[0].organization, data[0].latitude, data[0].longitude, data[0].cone_size, true);
        setSingleASLogicSlidingBarBaseInfo("AS" + asn + "详细信息", data[0].asn, data[0].name, data[0].organization, data[0].country, data[0].cone_size, data[0].cone_prefix_size, data[0].degree_provider, data[0].degree_peer, data[0].degree_customer, data[0].prefix_size);
        camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(data[0].longitude, data[0].latitude, flyHeight)
        });
        return ajaxPromise({
            url: baseURL + "/logic-links/detail",
            method: ajaxMethod,
            data: {asn: asn},
            timeout: ajaxTimeout,
            dataType: ajaxDataType
        });
    }).then(function(response) {
        if (response === undefined) {initLogicalTabView(); return;}
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load logical links: " + message);
            return;
        }
        if (dataLength === 0) {initLogicalTabView(); return;}
        const logicLinksArray = data;
        const p2cLogicLinkInstances = [], p2pLogicLinkInstances = [];
        

        const neighborAsns = new Set();

        logicLinksArray.forEach((dataItem, index) => {
            const srcIdx = dataItem.src_node_index, dstIdx = dataItem.dst_node_index, srcAsn = dataItem.src_asn, dstAsn = dataItem.dst_asn;
            const src_lat = dataItem.src_latitude, src_lon = dataItem.src_longitude, dst_lat = dataItem.dst_latitude, dst_lon = dataItem.dst_longitude;
            const linkType = dataItem.link_type;

            // add node
            if (srcAsn !== asn) {
                // addSingleNode(srcIdx, srcAsn, "", "", src_lat, src_lon, false);
                neighborAsns.add(srcAsn);
                const relationship = (linkType === "p2c")?"Provider":"Peer";
                neighborListData.push({asn: srcAsn, relationship: relationship});
            }
            else if (dstAsn !== asn) {
                // addSingleNode(dstIdx, dstAsn, "", "", dst_lat, dst_lon, false);
                neighborAsns.add(dstAsn);
                const relationship = (linkType === "p2c")?"Customer":"Peer";
                neighborListData.push({asn: dstAsn, relationship: relationship});
            }

            // add link
            let width = undefined;
            if (tier1AS.includes(srcAsn) && tier1AS.includes(dstAsn)) {
                width = localMaxLogicLinkLineWidth;
            }
            else {
                width = localMinLogicLinkLineWidth;
            }
            const logicLinkInstances = (linkType === "p2c")?p2cLogicLinkInstances:p2pLogicLinkInstances;
            logicLinkInstances.push(new Cesium.GeometryInstance({
                id: new LogicLinkID(dataItem.index, PRIMTYPE.LOGICLINK, srcIdx, dstIdx, srcAsn, dstAsn, linkType),
                geometry: new Cesium.PolylineGeometry({
                    vertexFormat : Cesium.VertexFormat.POSITION_ONLY,
                    positions: Cesium.Cartesian3.fromDegreesArrayHeights([src_lon, src_lat, localLogicLinkHeight, dst_lon, dst_lat, localLogicLinkHeight]),
                    width: width,
                }),
            }));
        });
        localLogicLinkCollection.add(new Cesium.Primitive({
            geometryInstances: p2cLogicLinkInstances,
            appearance: new Cesium.PolylineMaterialAppearance({
                translucent: true,
                material: Cesium.Material.fromType("Color", {
                    color: p2cLogicLinkColor.withAlpha(localP2CLogicLinkAlpha),
                })
            }),
        }));
        localLogicLinkCollection.add(new Cesium.Primitive({
            geometryInstances: p2pLogicLinkInstances,
            appearance: new Cesium.PolylineMaterialAppearance({
                translucent: true,
                material: Cesium.Material.fromType("Color", {
                    color: p2pLogicLinkColor.withAlpha(localP2PLogicLinkAlpha),
                })
            }),
        }));

        const params = Array.from(neighborAsns).join(",");
        return ajaxPromise({
            url: baseURL + "/logic-nodes/detail",
            method: ajaxMethod,
            data: {asns: params},
            timeout: ajaxTimeout,
            dataType: ajaxDataType
        });
    }).then(function(response) {
        if (response === undefined) {initLogicalTabView(); return;}
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load logical nodes: " + message);
            initLogicalTabView();
            return;
        }
        if (dataLength === 0) {initLogicalTabView(); return;}
        data.forEach(dataItem => {
            addSingleNode(dataItem.index, dataItem.asn, dataItem.name, dataItem.organization, dataItem.latitude, dataItem.longitude, dataItem.cone_size, false);
        });
        localNbrLogicNodeCollection.show = true;
        localLogicLinkCollection.show = true;
        localTargetLogicNodeCollection.show = true;

        document.getElementById('as-checkbox-span').textContent = "邻居AS";

        showLegend("普通AS", "Tier-1 AS", normalASColor.toCssColorString(), tier1ASColor.toCssColorString());

        setToggleState("as-checkbox", true);
        setToggleState("p2p-checkbox", true);
        setToggleState("p2c-checkbox", true);
        setSingleASLogicSlidingBarNbrList(neighborListData);
        showSpecificASLogicSlidingBar();
    });
}

/**
 * Set up event listener for close button of single-AS-physical-view mode sliding bar
 * @param
 * @return {void}
 */
function setupSingleASPhysicalSlidingBarCloseEventListener() {
    const closeSlidingbarBtn = document.getElementById('closeSlidingbar2');
    closeSlidingbarBtn.addEventListener('click', () => {
        const slidingbar = document.getElementById('slidingbar2');
        slidingbar.classList.remove('open');
        popCollection.removeAll();
        localPhysicalNodeCollection.removeAll();
        localDirectLinkCollection.removeAll();
        popCollection.show = false;
        localPhysicalNodeCollection.show = false;
        localDirectLinkCollection.show = false;
        tmpSubViewType = SUBVIEWTYPE.GLOBAL;
        tmpQueryType = QUERYTYPE.NONE;
        tmpQuerySingleAS = undefined;
        tmpQueryASTuple = undefined;
        clearSearchArea();
        initPhysicalTabView();
    });
}

/**
 * query single AS, show its physical view and sliding bar
 * @param {number} asn 
 * @return {void}
 */
function querySingleASPhysical(asn) {

    function showSingleASPhysicalSlidingBar() {
        const slidingbar = document.getElementById('slidingbar2');
        slidingbar.classList.add('open');
    }
    
    function setSingleASPhysicalSlidingBarInfo(asn, popMap, facilityMap, cityMap) {    
        const slidingbarTitle = document.getElementById('slidingbar2-title');
        slidingbarTitle.textContent = "AS" + asn + " PoP信息";
    
        const slidingBarContent = document.getElementById('slidingbar2-content');
        slidingBarContent.innerHTML = '';
        // Statistics
        let nbPoPWithFacility = 0;
        const countrySet = new Set();
        popMap.forEach((popItem, popIndex) => {
            if (popItem.facility_id !== -1) { nbPoPWithFacility++; }
            if (popItem.city_id !== -1) {
                const cityItem = cityMap.get(popItem.city_id); 
                countrySet.add(cityItem.country); 
            }
        });
        const nbCountry = countrySet.size;

        const table = document.createElement('table');
        const row1 = table.insertRow();
        const th1 = document.createElement('th');
        th1.colSpan = 2;
        th1.textContent = "统计信息";
        row1.appendChild(th1);
        const row2 = table.insertRow();
        const th2 = document.createElement('th');
        th2.textContent = "PoP总数";
        row2.appendChild(th2);
        const td2 = document.createElement('td');
        td2.textContent = popMap.size;
        row2.appendChild(td2);
        const row3 = table.insertRow();
        const th3 = document.createElement('th');
        th3.textContent = "已映射机房设施的PoP数量";
        row3.appendChild(th3);
        const td3 = document.createElement('td');
        td3.textContent = nbPoPWithFacility;
        row3.appendChild(td3);
        const row4 = table.insertRow();
        const th4 = document.createElement('th');
        th4.textContent = "覆盖国家/地区数量";
        row4.appendChild(th4);
        const td4 = document.createElement('td');
        td4.textContent = nbCountry;
        row4.appendChild(td4);
        slidingBarContent.appendChild(table);

        slidingBarContent.appendChild(document.createElement('hr'));
    
        popMap.forEach((popItem, popIndex) => {
            const latitude = popItem.latitude.toFixed(PRECISION), longitude = popItem.longitude.toFixed(PRECISION);
            const table = document.createElement('table');
            const row1 = table.insertRow();
            const th1 = document.createElement('th');
            th1.style.width = '30%';
            th1.textContent = 'PoP';
            row1.appendChild(th1);
            const td1 = document.createElement('td');
            td1.textContent = `${latitude},${longitude}`;
            td1.style.cursor = 'pointer'; // Make it look clickable
            td1.addEventListener('click', () => {
                // Call CesiumJS camera flyTo method
                if (camera) {
                    camera.flyTo({
                        destination: Cesium.Cartesian3.fromDegrees(longitude, latitude, flyHeight) // Adjust height as needed
                    });
                } else {
                    alert('Cesium viewer is not initialized.');
                }
            });
            row1.appendChild(td1);
    
            // Facility row
            const row2 = table.insertRow();
            const th2 = document.createElement('th');
            th2.style.width = '30%';
            th2.textContent = '机房设施';
            row2.appendChild(th2);
            const td2 = document.createElement('td');
            const facilityId = popItem.facility_id;
            if (facilityId !== -1) {
                const facilityItem = facilityMap.get(facilityId);
                td2.textContent = facilityItem.name;
            }
            else {
                td2.textContent = '未定位';
            }
            row2.appendChild(td2);
            // Organization row
            if (facilityId !== -1) {
                const row3 = table.insertRow();
                const th3 = document.createElement('th');
                th3.style.width = '30%';
                th3.textContent = '机构';
                row3.appendChild(th3);
                const td3 = document.createElement('td');
                const facilityItem = facilityMap.get(facilityId);
                td3.textContent = facilityItem.organization;
                row3.appendChild(td3);
            }
            // Location row
            const row4 = table.insertRow();
            const th4 = document.createElement('th');
            th4.style.width = '30%';
            th4.textContent = '地理位置';
            row4.appendChild(th4);
            const td4 = document.createElement('td');
            const cityId = popItem.city_id;
            if (cityId !== -1) {
                const cityItem = cityMap.get(cityId);
                td4.textContent = cityItem.city + ', ' + cityItem.state + ', ' + cityItem.country;
            }
            else {
                td4.textContent = '未定位';
            }
            row4.appendChild(td4);

            slidingBarContent.appendChild(table);
            slidingBarContent.appendChild(document.createElement('hr'));
        });
    }

    // Todo
    closeSlidingBar();
    tmpSubViewType = SUBVIEWTYPE.LOCAL;
    tmpQueryType = QUERYTYPE.SINGLE;
    tmpQuerySingleAS = asn;
    popCollection.removeAll();
    localPhysicalNodeCollection.removeAll();
    localDirectLinkCollection.removeAll();
    localLandCableLineCollection.removeAll();
    localSubmarineCableLineCollection.removeAll();
    localLandingPointCollection.removeAll();

    const popMap = new Map();
    const cityIDs = new Set();
    const cityMap = new Map();
    const facilityIDs = new Set();
    const facilityMap = new Map();
    const facilityId2Angle = new Map();

    ajaxPromise({
        url: baseURL + "/pop/detail",
        method: ajaxMethod,
        data: {asns: asn},
        timeout: ajaxTimeout,
        dataType: ajaxDataType
    }).then(function(response) {
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load physical nodes: " + message);
            return;
        }
        if (dataLength === 0) {
            alert("No data found for ASN: " + asn);
            return;
        }
        data.forEach(dataItem => {
            if (dataItem.facility_id !== -1) { facilityIDs.add(dataItem.facility_id); }
            if (dataItem.city_id !== -1) { cityIDs.add(dataItem.city_id); }
            popMap.set(dataItem.index, dataItem);
        });
        const params = Array.from(facilityIDs).join(",");
        return ajaxPromise({
            url: baseURL + "/physical-nodes/detail",
            method: ajaxMethod,
            data: {idxs: params},
            timeout: ajaxTimeout,
            dataType: ajaxDataType
        });
    }).then(function(response) {
        if (response === undefined) {
            console.error("Failed to load physical nodes: " + message);
            return;
        }
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load physical nodes: " + message);
            return;
        }
        if (dataLength === 0) {
            console.log("No data found for ASN: " + asn);
            return;
        }

        data.forEach(dataItem => {
            const position = Cesium.Cartesian3.fromDegrees(dataItem.longitude, dataItem.latitude, facilityHeight);
            const nodeID = new PhysicalNodeID(dataItem.index, PRIMTYPE.PHYNODE, dataItem.name, dataItem.organization, dataItem.latitude, dataItem.longitude, dataItem.city, dataItem.state, dataItem.country, dataItem.source, dataItem.date);
            localPhysicalNodeCollection.add({
                id : nodeID,
                position : position,
                pixelSize : phyNodeMinPixelSize,
                color : phyNodeColor,
                outlineColor : physicalNodeOutlineColor,
                outlineWidth : localPhyNodeOutlineWidth,
                scaleByDistance : new Cesium.NearFarScalar(phyNodeMinScaleDist, phyNodeMaxScaler, phyNodeMaxScaleDist, phyNodeMinScaler),
            });
            facilityMap.set(dataItem.index, dataItem);
            facilityId2Angle.set(dataItem.index, 0);
        });

        const params = Array.from(cityIDs).join(",");
        return ajaxPromise({
            url: baseURL + "/city/detail",
            method: ajaxMethod,
            data: {idxs: params},
            timeout: ajaxTimeout,
            dataType: ajaxDataType
        });
    }).then(function(response) {
        if (response === undefined) {
            initPhysicalTabView();
            return;
        }
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            initPhysicalTabView();
            return;
        }
        if (dataLength === 0) {
            initPhysicalTabView();
            return;
        }
        data.forEach(dataItem => {
            cityMap.set(dataItem.index, dataItem);
        });
        
        const directLinkInstances = new Array();
        const popIDs = new Array();
        popMap.forEach((popItem, popId) => {
            popIDs.push(popId);
            const popFacilityId = popItem.facility_id;
            const radius = 30000;
            let popLatitude = popItem.latitude, popLongitude = popItem.longitude;

            if (popFacilityId !== -1) {
                const facilityItem = facilityMap.get(popFacilityId);
                const popCoord = getPoPCoordinate({latitude: facilityItem.latitude, longitude: facilityItem.longitude}, facilityId2Angle.get(popFacilityId), radius);
                popLatitude = popCoord.latitude, popLongitude = popCoord.longitude;
            }
            else {
                popLatitude = popItem.latitude, popLongitude = popItem.longitude;
            }

            const position = Cesium.Cartesian3.fromDegrees(popLongitude, popLatitude, popHeight);
            const popID = new PoPID(popItem.index, PRIMTYPE.POP, popItem.asn, popItem.latitude, popItem.longitude, popItem.facility_id, popItem.city_id, popItem.landing_point_id, popItem.distance);
            popCollection.add({
                show : true,
                position : position,
                pixelSize : popPixelSize,
                color : popColors[1],
                outlineColor : Cesium.Color.BLACK,
                outlineWidth : popOutlineWidth,
                id : popID,
                scaleByDistance : new Cesium.NearFarScalar(popMinScaleDist, popMaxScaler, popMaxScaleDist, popMinScaler),
            });

            if (popFacilityId !== -1) {
                const facilityItem = facilityMap.get(popFacilityId);
                const sourceLat = facilityItem.latitude, sourceLon = facilityItem.longitude;
                const targetLat = popLatitude, targetLon = popLongitude;

                const linkGeometry = new Cesium.PolylineGeometry({
                    positions: Cesium.Cartesian3.fromDegreesArray([sourceLon, sourceLat, targetLon, targetLat]),
                    width: localDirectLinkWidth,
                });
                const linkInstance = new Cesium.GeometryInstance({
                    geometry: linkGeometry,
                    attributes: {
                        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.BLACK),
                    }
                });
                directLinkInstances.push(linkInstance);
            }
        });
        localDirectLinkCollection.add(new Cesium.Primitive({
            geometryInstances: directLinkInstances,
            appearance: new Cesium.PolylineColorAppearance({
                translucent: true,
            }),
        }));

        popCollection.show = true;
        localPhysicalNodeCollection.show = true;
        localDirectLinkCollection.show = true;

        physicalNodeCollection.show = false;
        physicalNodeLabelCollection.show = false;
        landingPointCollection.show = false;
        submarineCableLineCollection.show = false;
        landCableLineCollection.show = false;

        setToggleState("facility-checkbox", true);
        setToggleState("submarine-cable-checkbox", false);
        setToggleState("landing-points-checkbox", false);
        setToggleState("long-haul-cable-checkbox", false);

        setCheckBoxState("submarine-cable-checkbox", "disable");
        setCheckBoxState("landing-points-checkbox", "disable");
        setCheckBoxState("long-haul-cable-checkbox", "disable");

        setSingleASPhysicalSlidingBarInfo(asn, popMap, facilityMap, cityMap);
        showSingleASPhysicalSlidingBar();
        const targetPoP = popMap.get(popIDs[0]);
        camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(targetPoP.longitude, targetPoP.latitude, flyHeight)
        });
    });
}

/**
 * Set up event listener for close button of AS-tuple-logical-view mode sliding bar
 * @param
 * @return {void}
 */
function setupASTupleLogicSlidingBarCloseEventListener() {
    const closeSlidingbarBtn = document.getElementById('closeSlidingbar3');
    closeSlidingbarBtn.addEventListener('click', () => {
        document.getElementById('slidingbar3').classList.remove('open');
        localTargetLogicNodeCollection.removeAll();
        localNbrLogicNodeCollection.removeAll();
        localLogicLinkCollection.removeAll();
        localTargetLogicNodeCollection.show = false;
        localNbrLogicNodeCollection.show = false;
        localLogicLinkCollection.show = false;
        tmpSubViewType = SUBVIEWTYPE.GLOBAL;
        tmpQueryType = QUERYTYPE.NONE;
        tmpQuerySingleAS = undefined;
        tmpQueryASTuple = undefined;
        clearSearchArea();
        initLogicalTabView();
    });
}

/**
 * query AS tuple, show its logical view and sliding bar
 * @param {number} asn1 
 * @param {number} asn2 
 * @return {void}
 */
function queryASTupleLogic(asn1, asn2) {

    function setASTupleLogicSlidingBarBaseInfo(srcNode, dstNode, link_type) {
        document.getElementById('slidingbar3-title').textContent = "AS" + srcNode.asn + " - AS" + dstNode.asn + " 互联信息";
        
        document.getElementById('slidingbar3Asn1').textContent = srcNode.asn;
        document.getElementById('slidingbar3Name1').textContent = srcNode.name;
        document.getElementById('slidingbar3Org1').textContent = srcNode.organization;
        document.getElementById('slidingbar3Region1').textContent = srcNode.country;
    
        document.getElementById('slidingbar3Asn2').textContent = dstNode.asn;
        document.getElementById('slidingbar3Name2').textContent = dstNode.name;
        document.getElementById('slidingbar3Org2').textContent = dstNode.organization;
        document.getElementById('slidingbar3Region2').textContent = dstNode.country;
    
        document.getElementById('slidingbar3Relationship').textContent = link_type;
    }
    
    function showASTupleLogicSlidingBar() {
        document.getElementById('slidingbar3').classList.add('open');
    }

    closeSlidingBar();
    tmpSubViewType = SUBVIEWTYPE.LOCAL;
    tmpQueryType = QUERYTYPE.TUPLE;
    tmpQueryASTuple = { asn1: asn1, asn2: asn2 };
    logicNodeCollection.show = false;
    logicLinkCollection.get(p2cLinkIndex).show = false;
    logicLinkCollection.get(p2pLinkIndex).show = false;
    localLogicLinkCollection.removeAll();
    localNbrLogicNodeCollection.removeAll();
    localTargetLogicNodeCollection.removeAll();
    let linkIndex, src_asn, dst_asn, link_type;

    ajaxPromise({
        url: baseURL + "/logic-links/detail",
        method: ajaxMethod,
        data: {astuple: asn1 + "," + asn2},
        timeout: ajaxTimeout,
        dataType: ajaxDataType
    }).then(function(response) {
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load logical links: " + message);
            return;
        }
        if (dataLength === 0) {
            alert("No logical links between AS" + asn1 + " and AS" + asn2 + ".");
            return;
        }
        linkIndex = data[0].index, src_asn = data[0].src_asn, dst_asn = data[0].dst_asn, link_type = data[0].link_type;
        return ajaxPromise({
            url: baseURL + "/logic-nodes/detail",
            method: ajaxMethod,
            data: {asns: src_asn + "," + dst_asn},
            timeout: ajaxTimeout,
            dataType: ajaxDataType
        });
    }).then(function(response) {
        if (response === undefined) {initLogicalTabView(); return;}
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load logical nodes: " + message);
            initLogicalTabView();
            return;
        }
        let srcNode, dstNode;
        data.forEach(dataItem => {
            if (dataItem.asn === src_asn) {
                srcNode = dataItem;
            }
            else if (dataItem.asn === dst_asn) {
                dstNode = dataItem;
            }
        });
        const srcPos = [srcNode.latitude, srcNode.longitude];
        const dstPos = [dstNode.latitude, dstNode.longitude];
        const srcConeSize = srcNode.cone_size, dstConeSize = dstNode.cone_size;
        localNbrLogicNodeCollection.add({
            id : new LogicNodeID(srcNode.index, PRIMTYPE.LOGICNODE, srcNode.asn, srcNode.name, srcNode.organization),
            position : Cesium.Cartesian3.fromDegrees(srcNode.longitude, srcNode.latitude, localLogicNodeHeight),
            pixelSize : calculateLogicNodePixelSize(Math.log(srcConeSize), minLocalLogicNodePixelSize, maxLocalLogicNodePixelSize, minGlobalConeSize, maxGlobalConeSize),
            color : tier1AS.includes(srcNode.asn) ? tier1ASColor : normalASColor,
            outlineColor : localLogicNodeOutlineColor,
            outlineWidth : localLogicNodeOutlineWidth,
            scaleByDistance: new Cesium.NearFarScalar(localLogicNodeMinScaleDist, localLogicNodeMaxScaler, localLogicNodeMaxScaleDist, localLogicNodeMinScaler),
        });
        localNbrLogicNodeCollection.add({
            id : new LogicNodeID(dstNode.index, PRIMTYPE.LOGICNODE, dstNode.asn, dstNode.name, dstNode.organization),
            position : Cesium.Cartesian3.fromDegrees(dstNode.longitude, dstNode.latitude, localLogicNodeHeight),
            pixelSize : calculateLogicNodePixelSize(Math.log(dstConeSize), minLocalLogicNodePixelSize, maxLocalLogicNodePixelSize, minGlobalConeSize, maxGlobalConeSize),
            color : tier1AS.includes(dstNode.asn) ? tier1ASColor : normalASColor,
            outlineColor : localLogicNodeOutlineColor,
            outlineWidth : localLogicNodeOutlineWidth,
            scaleByDistance: new Cesium.NearFarScalar(localLogicNodeMinScaleDist, localLogicNodeMaxScaler, localLogicNodeMaxScaleDist, localLogicNodeMinScaler),
        });
        const p2clogicLinkInstances = [], p2plogicLinkInstances = [];
        const logicLinkInstances = (link_type === "p2c")?p2clogicLinkInstances:p2plogicLinkInstances;
        logicLinkInstances.push(new Cesium.GeometryInstance({
            id: new LogicLinkID(linkIndex, PRIMTYPE.LOGICLINK, srcNode.index, dstNode.index, srcNode.asn, dstNode.asn, link_type),
            geometry: new Cesium.PolylineGeometry({
                vertexFormat : Cesium.VertexFormat.POSITION_ONLY,
                positions: Cesium.Cartesian3.fromDegreesArrayHeights([srcPos[1], srcPos[0], localLogicLinkHeight, dstPos[1], dstPos[0], localLogicLinkHeight]),
                width: tier1AS.includes(srcNode.asn) && tier1AS.includes(dstNode.asn) ? localMaxLogicLinkLineWidth : localMinLogicLinkLineWidth,
            }),
        }));
        localLogicLinkCollection.add(new Cesium.Primitive({
            geometryInstances: p2clogicLinkInstances,
            appearance: new Cesium.PolylineMaterialAppearance({
                translucent: true,
                material: Cesium.Material.fromType("Color", {
                    color: p2cLogicLinkColor.withAlpha(localP2CLogicLinkAlpha),
                })
            }),
        }));
        localLogicLinkCollection.add(new Cesium.Primitive({
            geometryInstances: p2plogicLinkInstances,
            appearance: new Cesium.PolylineMaterialAppearance({
                translucent: true,
                material: Cesium.Material.fromType("Color", {
                    color: p2pLogicLinkColor.withAlpha(localP2PLogicLinkAlpha),
                })
            }),
        }));
        localNbrLogicNodeCollection.show = true;
        localLogicLinkCollection.show = true;

        showLegend("普通AS", "Tier-1 AS", normalASColor.toCssColorString(), tier1ASColor.toCssColorString());

        setToggleState("as-checkbox", true);
        setToggleState("p2p-checkbox", true);
        setToggleState("p2c-checkbox", true);
        setASTupleLogicSlidingBarBaseInfo(srcNode, dstNode, link_type);
        showASTupleLogicSlidingBar();
        camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees((srcPos[1] + dstPos[1]) / 2, (srcPos[0] + dstPos[0]) / 2, flyHeight)
        });
    });
}

/**
 * show legend of AS tuple
 * @param {number} asn1 
 * @param {number} asn2
 * @return {void} 
 */
function showLegend(content1, content2, colorStr1, colorStr2) {
    const srcAsnElem = document.getElementById('srcAsn');
    const dstAsnElem = document.getElementById('dstAsn');
    const borderStyle = 'text-shadow: -1px -1px 0 black, 1px -1px 0 black, -1px 1px 0 black, 1px 1px 0 black;';
    srcAsnElem.textContent = content1;
    dstAsnElem.textContent = content2;
    const legendPoint1 = document.getElementById('legend-point-1');
    const legendPoint2 = document.getElementById('legend-point-2');
    legendPoint1.style = `color: ${colorStr1}; ` + borderStyle;
    legendPoint2.style = `color: ${colorStr2}; ` + borderStyle;
    const legend = document.getElementById('legend');
    legend.style.visibility = 'visible';
}

/**
 * close legend of AS tuple
 * @param
 * @return {void}
 */
function closeLegend() {
    const legend = document.getElementById('legend');
    legend.style.visibility = 'hidden';
}

/**
 * query AS tuple, show its physical view and sliding bar
 * @param {number} asn1 
 * @param {number} asn2 
 * @return {void}
 */
function queryASTuplePhysical(asn1, asn2) {

    function setASTuplePhysicalSlidingBarInfo(phyLinkItems, popMap, facilityMap, cityMap, landCableMap, submarineSegMap, landingPointMap, asn1, asn2) {

        function addPoP(table, popIndex, lIndex) {
            const latitude1 = popMap.get(popIndex).latitude.toFixed(PRECISION), longitude1 = popMap.get(popIndex).longitude.toFixed(PRECISION);
            const pop1Row = table.insertRow();
            const pop1Header = document.createElement('th');
            pop1Header.textContent = `PoP${lIndex}`;
            pop1Header.style.width = '30%';
            pop1Row.appendChild(pop1Header);
            const pop1Data = document.createElement('td');
            pop1Data.textContent = `${latitude1},${longitude1}`;
            pop1Row.appendChild(pop1Data);
            pop1Data.addEventListener('click', () => {
                // Call CesiumJS camera flyTo method
                if (camera) {
                    camera.flyTo({
                        destination: Cesium.Cartesian3.fromDegrees(longitude1, latitude1, flyHeight) // Adjust height as needed
                    });
                } else {
                    alert('Cesium viewer is not initialized.');
                }
            });
        }
    
        function addASN(table, popIndex, lIndex) {
            const asn = popMap.get(popIndex).asn;
            const asnRow = table.insertRow();
            const asnHeader = document.createElement('th');
            asnHeader.textContent = `ASN`;
            asnHeader.style.width = '30%';
            asnRow.appendChild(asnHeader);
            const asnData = document.createElement('td');
            asnData.textContent = asn;
            asnRow.appendChild(asnData);
        }
    
        function addLocation(table, popIndex, lIndex) {
            const location1Row = table.insertRow();
            const location1Header = document.createElement('th');
            location1Header.textContent = `地理位置`;
            location1Header.style.width = '30%';
            location1Row.appendChild(location1Header);
            const location1Data = document.createElement('td');
            if (popMap.get(popIndex).city_id !== -1) {
                const popCity = cityMap.get(popMap.get(popIndex).city_id);
                location1Data.textContent = `${popCity.city}, ${popCity.state}, ${popCity.country}`;
            }
            else {
                location1Data.textContent = '未定位';
            }
            location1Row.appendChild(location1Data);
        }

        function addType(table, link_type) {
            const typeRow = table.insertRow();
            const typeHeader = document.createElement('th');
            typeHeader.textContent = '互联类型';
            typeHeader.style.width = '30%';
            typeRow.appendChild(typeHeader);
            const typeData = document.createElement('td');
            typeData.textContent = link_type;
            typeRow.appendChild(typeData);
        }

    
        const slidingbarTitle = document.getElementById('slidingbar4-title');
        slidingbarTitle.textContent = "AS" + asn1 + " - AS" + asn2 + " 互联信息";
        const slidingbar4Content = document.getElementById('slidingbar4Content');
        slidingbar4Content.innerHTML = '';

        // statistics
        // -- 1. header
        const table = document.createElement('table');
        const statHeader = table.insertRow();
        const statHeaderCell = document.createElement('th');
        statHeaderCell.textContent = '统计信息';
        statHeaderCell.colSpan = 2;
        statHeaderCell.className = 'link-header';
        statHeader.appendChild(statHeaderCell);
        // -- 2. statistics
        const nbOfType = new Array(3).fill(0);
        const linkTypes = ['facility', 'submarine', 'landcable'];
        const linkTypesCN = ['机房设施互联数量', '海底光缆互联数量', '陆地光缆互联数量'];
        phyLinkItems.forEach(phyLinkItem => {
            nbOfType[linkTypes.indexOf(phyLinkItem.ltype)]++;
        });
        for (let i=0; i<3; i++) {
            const statRow = table.insertRow();
            const statTypeCell = document.createElement('th');
            statTypeCell.textContent = linkTypesCN[i];
            statRow.appendChild(statTypeCell);
            const statNbCell = document.createElement('td');
            statNbCell.textContent = nbOfType[i];
            statRow.appendChild(statNbCell);
        }
        slidingbar4Content.appendChild(table);

        phyLinkItems.forEach((phyLinkItem, index) => {
            const table = document.createElement('table');
    
            // Link Index Row (Span 2 columns)
            const linkIndexRow = table.insertRow();
            const linkIndexCell = document.createElement('th');
            linkIndexCell.textContent = `link ${index + 1}`;
            linkIndexCell.colSpan = 2;
            linkIndexCell.className = 'link-index';
            linkIndexRow.appendChild(linkIndexCell);

            addPoP(table, phyLinkItem.src_pop_index, 1);
            addASN(table, phyLinkItem.src_pop_index, 1);
            addLocation(table, phyLinkItem.src_pop_index, 1);
            addPoP(table, phyLinkItem.dst_pop_index, 2);
            addASN(table, phyLinkItem.dst_pop_index, 2);
            addLocation(table, phyLinkItem.dst_pop_index, 2);
            addType(table, linkTypesCN[linkTypes.indexOf(phyLinkItem.ltype)].slice(0, 6));
            slidingbar4Content.appendChild(table);
        });
    }

    function showASTuplePhysicalSlidingBar() {
        const slidingbar = document.getElementById('slidingbar4');
        slidingbar.classList.add('open');
    }

    closeSlidingBar();
    tmpSubViewType = SUBVIEWTYPE.LOCAL;
    tmpQueryType = QUERYTYPE.TUPLE;
    tmpQueryASTuple = { asn1: asn1, asn2: asn2 };
    popCollection.removeAll();
    localPhysicalNodeCollection.removeAll();
    localLandCableLineCollection.removeAll();
    localDirectLinkCollection.removeAll();
    localSubmarineCableLineCollection.removeAll();
    localLandingPointCollection.removeAll();

    const phyLinkItems = new Array();

    const popIds = new Set();
    const popMap = new Map();
    const popDrawFlag = new Map();

    const facilityIds = new Set();
    const facilityMap = new Map();

    const cityIds = new Set();
    const cityMap = new Map();

    const landCableIds = new Set();
    const landCableMap = new Map();

    const submarineSegIds = new Set();
    const submarineSegMap = new Map();

    const landingPointIds = new Set();
    const landingPointMap = new Map();
    const landingPointDrawFlag = new Map();

    ajaxPromise({
        url: baseURL + "/phy-links/detail",
        method: ajaxMethod,
        data: { astuple: asn1 + "," + asn2 },
        timeout: ajaxTimeout,
        dataType: ajaxDataType,
    }).then(function(response) {
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load physical links: " + message);
            return;
        }
        if (dataLength === 0) {
            alert("No physical links between AS" + asn1 + " and AS" + asn2 + ".");
            return;
        }
        data.forEach(dataItem => {
            phyLinkItems.push(dataItem);
            // related pop index
            popIds.add(dataItem.src_pop_index);
            popIds.add(dataItem.dst_pop_index);
            // related facility index
            const phyLinkFacilityID = dataItem.facility_id;
            if (phyLinkFacilityID !== -1) {facilityIds.add(phyLinkFacilityID);}
            // related city index
            const phyLinkSrcCityID = dataItem.src_city_id, phyLinkDstCityId = dataItem.dst_city_id;
            if (phyLinkSrcCityID !== -1) {cityIds.add(phyLinkSrcCityID);}
            if (phyLinkDstCityId !== -1) {cityIds.add(phyLinkDstCityId);}
            // related land cable index
            const phyLinkLandCableIDs = dataItem.land_cable_id;
            phyLinkLandCableIDs.forEach(phyLinkLandCableId => {
                if (phyLinkLandCableId !== -1) {landCableIds.add(phyLinkLandCableId);}
            });
            // related submarine seg
            const phyLinkSubmarineSegId = dataItem.submarine_seg_id;
            if (phyLinkSubmarineSegId !== -1) {submarineSegIds.add(phyLinkSubmarineSegId);}
            // related landing point
            const phyLinkSrcLandingPointId = dataItem.src_landing_point_id, phyLinkDstLandingPointId = dataItem.dst_landing_point_id;
            if (phyLinkSrcLandingPointId !== -1) {landingPointIds.add(phyLinkSrcLandingPointId);}
            if (phyLinkDstLandingPointId !== -1) {landingPointIds.add(phyLinkDstLandingPointId);}
        });

        // const params = Array.from(popIds).join(",");
        const params = `${asn1},${asn2}`;
        return ajaxPromise({
            url: baseURL + "/pop/detail",
            method: ajaxMethod,
            data: {asns: params},
            timeout: ajaxTimeout,
            dataType: ajaxDataType
        });
    }).then(function(response) {
        if (response === undefined) { return; }
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load PoPs: " + message);
            return;
        }
        if (dataLength === 0) {
            return;
        }
        data.forEach(dataItem => {
            popMap.set(dataItem.index, dataItem);
        });
        
        const params = Array.from(facilityIds).join(",");
        return ajaxPromise({
            url: baseURL + "/physical-nodes/detail",
            method: ajaxMethod,
            data: {idxs: params},
            timeout: ajaxTimeout,
            dataType: ajaxDataType
        });
    }).then(function(response) {
        if (response === undefined) { return; }
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load physical nodes: " + message);
            return;
        }
        data.forEach(dataItem => {
            facilityMap.set(dataItem.index, dataItem);
        });

        const params = Array.from(cityIds).join(",");
        return ajaxPromise({
            url: baseURL + "/city/detail",
            method: ajaxMethod,
            data: {idxs: params},
            timeout: ajaxTimeout,
            dataType: ajaxDataType
        });

    }).then(function(response) {
        if (response === undefined) { return; }
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load city: " + message);
            return;
        }
        data.forEach(dataItem => {
            cityMap.set(dataItem.index, dataItem);
        });

        const params = Array.from(landCableIds).join(",");
        return ajaxPromise({
            url: baseURL + "/land-cables/detail",
            method: ajaxMethod,
            data: {idxs: params},
            timeout: ajaxTimeout,
            dataType: ajaxDataType
        });

        
    }).then(function(response) {
        if (response === undefined) { return; }
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load land cables: " + message);
            return;
        }
        data.forEach(dataItem => {
            landCableMap.set(dataItem.index, dataItem);
        });

        const params = Array.from(submarineSegIds).join(",");
        return ajaxPromise({
            url: baseURL + "/submarine-segments/detail",
            method: ajaxMethod,
            data: {idxs: params},
            timeout: ajaxTimeout,
            dataType: ajaxDataType
        });
    }).then(function(response) {
        if (response === undefined) { return; }
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load submarine segments: " + message);
            return;
        }
        data.forEach(dataItem => {
            submarineSegMap.set(dataItem.index, dataItem);
        });

        const params = Array.from(landingPointIds).join(",");
        return ajaxPromise({
            url: baseURL + "/landing-points/detail",
            method: ajaxMethod,
            data: {cidxs: params},
            dataType: ajaxDataType,
            timeout: ajaxTimeout,
        });
    }).then(function(response) {
        if (response === undefined) { initPhysicalTabView(); return; }
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load landing points: " + message);
            initPhysicalTabView();
            return;
        }
        data.forEach(dataItem => {
            landingPointMap.set(dataItem.cable_id, dataItem);
        });

        const popColorMap = new Map();
        popColorMap.set(asn1, popColors[0].withAlpha(unhoverAlpha));
        popColorMap.set(asn2, popColors[1].withAlpha(unhoverAlpha));
        const hslColorList = generateHSLColors(phyLinkItems.length);
        const linkColorList = hslColorList.map(color => Cesium.Color.fromCssColorString(color));
        const outlineColor = Cesium.Color.BLACK;
        const directLinkInstances = new Array();
        const landCableInstances = new Array();
        const submarineCableInstances = new Array();

        function drawPoP(popItem) {
            if (popDrawFlag.get(popItem.index) === undefined) {
                const position = Cesium.Cartesian3.fromDegrees(popItem.longitude, popItem.latitude, popHeight);
                const nodeID = new PoPID(popItem.index, PRIMTYPE.POP, popItem.asn, popItem.latitude, popItem.longitude, popItem.facility_id, popItem.city_id, popItem.landing_point_id, popItem.distance);
                popCollection.add({
                    id : nodeID,
                    show : true,
                    position : position,
                    pixelSize : popPixelSize,
                    color : popColorMap.get(popItem.asn),
                    outlineColor : Cesium.Color.BLACK,
                    outlineWidth : popOutlineWidth,
                    scaleByDistance: new Cesium.NearFarScalar(popMinScaleDist, popMaxScaler, popMaxScaleDist, popMinScaler),
                });
                popDrawFlag.set(popItem.index, popCollection.length - 1);
            }
            return popDrawFlag.get(popItem.index);
        }

        function drawLandingPoint(landingPointItem) {
            if (landingPointDrawFlag.get(landingPointItem.cable_id) === undefined) {
                const position = Cesium.Cartesian3.fromDegrees(landingPointItem.longitude, landingPointItem.latitude, localLandingPointHeight);
                const nodeID = new LandingPointID(landingPointItem.cable_id, PRIMTYPE.LANDINGPOINT, landingPointItem.city, landingPointItem.state, landingPointItem.country, landingPointItem.latitude, landingPointItem.longitude, landingPointItem.source, landingPointItem.date);
                localLandingPointCollection.add({
                    id : nodeID,
                    show : true,
                    position : position,
                    pixelSize : localLandingPointPixelSize,
                    color : landingPointColor,
                    outlineColor : Cesium.Color.BLACK,
                    outlineWidth : localLandingPointOutlineWidth,
                    scaleByDistance: new Cesium.NearFarScalar(localLandingPointMinScaleDist, localLandingPointMaxScaler, localLandingPointMaxScaleDist, localLandingPointMinScaler),
                });
                landingPointDrawFlag.set(landingPointItem.cable_id, localLandingPointCollection.length - 1);
            }
            return landingPointDrawFlag.get(landingPointItem.cable_id);
        }

        function drawLink(src_lat, src_lon, dst_lat, dst_lon, linkColor, linkInstances) {
            const linkGeometry = new Cesium.GroundPolylineGeometry({
                positions: Cesium.Cartesian3.fromDegreesArray([src_lon, src_lat, dst_lon, dst_lat]),
                width: localDirectLinkWidth,
            });
            const linkInstance = new Cesium.GeometryInstance({
                geometry: linkGeometry,
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(linkColor.withAlpha(landcableUnhoverAlpha)),
                }
            });
            linkInstances.push(linkInstance);
        }

        phyLinkItems.forEach((phyLinkItem) => {
            const srcPoPItem = popMap.get(phyLinkItem.src_pop_index), dstPoPItem = popMap.get(phyLinkItem.dst_pop_index);
            const srcLat = srcPoPItem.latitude, srcLon = srcPoPItem.longitude, dstLat = dstPoPItem.latitude, dstLon = dstPoPItem.longitude;
            if (((srcLat - dstLat) < INTERSEC_PREC) && ((srcLon - dstLon) < INTERSEC_PREC)) {
                let popItem = (Math.random() > 0.5) ? srcPoPItem : dstPoPItem;
                const popPosition = coordnateOffset(popItem.latitude, popItem.longitude);
                popItem.latitude = popPosition[0];
                popItem.longitude = popPosition[1];
            }
        });

        

        phyLinkItems.forEach((phyLinkItem, phyLinkIndex) => {
            const linkType = phyLinkItem.ltype;
            const srcPoPItem = popMap.get(phyLinkItem.src_pop_index), dstPoPItem = popMap.get(phyLinkItem.dst_pop_index);
            const srcPoPIndex = drawPoP(srcPoPItem), dstPoPIndex = drawPoP(dstPoPItem);
            
            const phyLinkColor = linkColorList[phyLinkIndex];
            switch(linkType) {
                case 'facility':
                    const facilityItem = facilityMap.get(phyLinkItem.facility_id);
                    localPhysicalNodeCollection.add({
                        id : new FacilityInterConnID(phyLinkIndex, InterConnType.FACILITY, srcPoPIndex, dstPoPIndex, phyLinkItem.src_asn, phyLinkItem.dst_asn, 
                            facilityItem.name, facilityItem.organization, facilityItem.city, facilityItem.state, facilityItem.country),
                        show : true,
                        position : Cesium.Cartesian3.fromDegrees(facilityItem.longitude, facilityItem.latitude, localPhyNodeHeight),
                        pixelSize : localPhyNodePixelSize,
                        color : phyNodeColor,
                        outlineColor : outlineColor,
                        outlineWidth : localPhyNodeOutlineWidth,
                        scaleByDistance: new Cesium.NearFarScalar(localPhyNodeMinScaleDist, localPhyNodeMaxScaler, localPhyNodeMaxScaleDist, localPhyNodeMinScaler),
                    });
                    drawLink(srcPoPItem.latitude, srcPoPItem.longitude, facilityItem.latitude, facilityItem.longitude, phyLinkColor, directLinkInstances);
                    drawLink(facilityItem.latitude, facilityItem.longitude, dstPoPItem.latitude, dstPoPItem.longitude, phyLinkColor, directLinkInstances);
                    break;
                case 'landcable':
                    let cableGeoCoordinates = new Array();
                    const srcCityItem = cityMap.get(phyLinkItem.src_city_id), dstCityItem = cityMap.get(phyLinkItem.dst_city_id);
                    let lastCity = srcCityItem.city, lastState = srcCityItem.state, lastCountry = srcCityItem.country;
                    phyLinkItem.land_cable_id.forEach(landCableId => {
                        const landCableItem = landCableMap.get(landCableId);
                        let cablePositions = JSON.parse(JSON.stringify(landCableItem.coordinates));
                        if (lastCity !== landCableItem.from_city || lastState !== landCableItem.from_state || lastCountry !== landCableItem.from_country) {
                            cablePositions.reverse();
                            lastCity = landCableItem.from_city;
                            lastState = landCableItem.from_state;
                            lastCountry = landCableItem.from_country;
                        }
                        else {
                            lastCity = landCableItem.to_city;
                            lastState = landCableItem.to_state;
                            lastCountry = landCableItem.to_country;
                        }
                        cablePositions = cablePositions.flat();
                        cableGeoCoordinates.push(...cablePositions);
                    });
                    for (let i=2; i<cableGeoCoordinates.length-2; i+=2) {
                        const positionOffset = coordnateOffset(cableGeoCoordinates[i+1], cableGeoCoordinates[i]);
                        cableGeoCoordinates[i] = positionOffset[1];
                        cableGeoCoordinates[i+1] = positionOffset[0];
                    }
                    const cablePositions = Cesium.Cartesian3.fromDegreesArray(cableGeoCoordinates);
                    const cableGeometry = new Cesium.GroundPolylineGeometry({
                        positions: cablePositions,
                        width: localLandCableLineWidth,
                    });
                    landCableInstances.push(new Cesium.GeometryInstance({
                        id: new LandCableInterConnID(phyLinkIndex, InterConnType.LANDCABLE, srcPoPIndex, dstPoPIndex, phyLinkItem.src_asn, phyLinkItem.dst_asn, 
                            srcCityItem.city, srcCityItem.state, srcCityItem.country, dstCityItem.city, dstCityItem.state, dstCityItem.country),
                        geometry: cableGeometry,
                        attributes: {
                            color: Cesium.ColorGeometryInstanceAttribute.fromColor(phyLinkColor.withAlpha(landcableUnhoverAlpha)),
                        },
                    }));
                    
                    drawLink(srcPoPItem.latitude, srcPoPItem.longitude, srcCityItem.latitude, srcCityItem.longitude, phyLinkColor, directLinkInstances);
                    drawLink(dstCityItem.latitude, dstCityItem.longitude, dstPoPItem.latitude, dstPoPItem.longitude, phyLinkColor, directLinkInstances);
                    break;
                case 'submarine':
                    const srcLandingPoint = landingPointMap.get(phyLinkItem.src_landing_point_id), dstLandingPoint = landingPointMap.get(phyLinkItem.dst_landing_point_id);
                    const src_lp_lat = srcLandingPoint.latitude, src_lp_lon = srcLandingPoint.longitude;
                    const dst_lp_lat = dstLandingPoint.latitude, dst_lp_lon = dstLandingPoint.longitude;
                    const srcLpIndex = drawLandingPoint(srcLandingPoint), dstLpIndex = drawLandingPoint(dstLandingPoint);
                    drawLink(srcPoPItem.latitude, srcPoPItem.longitude, src_lp_lat, src_lp_lon, phyLinkColor, directLinkInstances);
                    drawLink(dst_lp_lat, dst_lp_lon, dstPoPItem.latitude, dstPoPItem.longitude, phyLinkColor, directLinkInstances);

                    const submarineSegItem = submarineSegMap.get(phyLinkItem.submarine_seg_id);
                    const coordinates = submarineSegItem.coordinates.flat();
                    for (let i=2; i<coordinates.length-2; i+=2) {
                        const positionOffset = coordnateOffset(coordinates[i+1], coordinates[i]);
                        coordinates[i] = positionOffset[1];
                        coordinates[i+1] = positionOffset[0];
                    }
                    const segPositions = Cesium.Cartesian3.fromDegreesArray(coordinates);
                    const segGeometry = new Cesium.GroundPolylineGeometry({
                        positions: segPositions,
                        width: localSubmarineCableLineWidth,
                    });
                    const segInstance = new Cesium.GeometryInstance({
                        id: new SubmarineCableInterConnID(phyLinkIndex, InterConnType.SUBMARINECABLE, srcPoPIndex, dstPoPIndex, phyLinkItem.src_asn, phyLinkItem.dst_asn, srcLpIndex, dstLpIndex, 
                            srcLandingPoint.cable_id, dstLandingPoint.cable_id, ""),
                        geometry: segGeometry,
                        attributes: {
                            color: Cesium.ColorGeometryInstanceAttribute.fromColor(phyLinkColor.withAlpha(submarinecableUnhoverAlpha)),
                        },
                    });
                    submarineCableInstances.push(segInstance);
                    break;
            }
        });

        popMap.forEach((popItem, popIndex) => {
            if (popDrawFlag.get(popIndex) === undefined) {
                const position = Cesium.Cartesian3.fromDegrees(popItem.longitude, popItem.latitude, popHeight);
                const nodeID = new PoPID(popItem.index, PRIMTYPE.POP, popItem.asn, popItem.latitude, popItem.longitude, popItem.facility_id, popItem.city_id, popItem.landing_point_id, popItem.distance);
                popCollection.add({
                    id : nodeID,
                    show : true,
                    position : position,
                    pixelSize : popPixelSize,
                    color : popColorMap.get(popItem.asn).withAlpha(0.2),
                    outlineColor : Cesium.Color.BLACK.withAlpha(0.2),
                    outlineWidth : popOutlineWidth,
                    scaleByDistance: new Cesium.NearFarScalar(popMinScaleDist, popMaxScaler, popMaxScaleDist, popMinScaler),
                });
                popDrawFlag.set(popItem.index, popCollection.length - 1);
            }
        });

        localDirectLinkCollection.add(new Cesium.GroundPolylinePrimitive({
            geometryInstances: directLinkInstances,
            appearance: new Cesium.PolylineColorAppearance({
                translucent: true,
            }),
        }));
        localLandCableLineCollection.add(new Cesium.GroundPolylinePrimitive({
            geometryInstances: landCableInstances,
            appearance: new Cesium.PolylineColorAppearance({
                translucent: true,
            }),
        }));
        localSubmarineCableLineCollection.add(new Cesium.GroundPolylinePrimitive({
            geometryInstances: submarineCableInstances,
            appearance: new Cesium.PolylineColorAppearance({
                translucent: true,
            }),
        }));

        popCollection.show = true;
        localDirectLinkCollection.show = true;
        localPhysicalNodeCollection.show = true;
        localLandCableLineCollection.show = true;
        localSubmarineCableLineCollection.show = true;
        localLandingPointCollection.show = true;

        physicalNodeCollection.show = false;
        physicalNodeLabelCollection.show = false;
        landingPointCollection.show = false;
        submarineCableLineCollection.show = false;
        landCableLineCollection.show = false;

        setToggleState("facility-checkbox", true);
        setToggleState("submarine-cable-checkbox", true);
        setToggleState("landing-points-checkbox", true);
        setToggleState("long-haul-cable-checkbox", true);

        setASTuplePhysicalSlidingBarInfo(phyLinkItems, popMap, facilityMap, cityMap, landCableMap, submarineSegMap, landingPointMap, asn1, asn2);
        showASTuplePhysicalSlidingBar();
        showLegend(`AS${asn1}`, `AS${asn2}`, popColorMap.get(asn1).toCssColorString(), popColorMap.get(asn2).toCssColorString());

        const popItem = popMap.get(phyLinkItems[0].src_pop_index);
        camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(popItem.longitude, popItem.latitude, flyHeight)
        });
    });
}

/**
 * Set up event listener for close button of AS-tuple-physical-view mode sliding bar
 * @param
 * @return {void}
 */
function setupASTuplePhysicalSlidingBarCloseEventListener() {
    const closeSlidingbarBtn = document.getElementById('closeSlidingbar4');
    closeSlidingbarBtn.addEventListener('click', () => {
        const slidingbar = document.getElementById('slidingbar4');
        slidingbar.classList.remove('open');
        popCollection.removeAll();
        localPhysicalNodeCollection.removeAll();
        localLandCableLineCollection.removeAll();
        localSubmarineCableLineCollection.removeAll();
        localDirectLinkCollection.removeAll();
        localLandingPointCollection.removeAll();
        popCollection.show = false;
        localPhysicalNodeCollection.show = false;
        localLandCableLineCollection.show = false;
        localSubmarineCableLineCollection.show = false;
        localLandingPointCollection.show = false;
        localDirectLinkCollection.show = false;
        tmpSubViewType = SUBVIEWTYPE.GLOBAL;
        tmpQueryType = QUERYTYPE.NONE;
        tmpQuerySingleAS = undefined;
        tmpQueryASTuple = undefined;

        setCheckBoxState("submarine-cable-checkbox", "enable");
        setCheckBoxState("landing-points-checkbox", "enable");
        setCheckBoxState("long-haul-cable-checkbox", "enable");

        closeLegend();
        clearSearchArea();
        initPhysicalTabView();
    });
}
