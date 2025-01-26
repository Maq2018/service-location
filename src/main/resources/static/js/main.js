// import geoUtils
import { haversineDistance, areCoordinatesNear } from './geoUtils.js';
// import chroma from 'chroma-js';

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
});
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
    SUBCABLE: "SubmarineCable",
    LANDCABLE: "LandCable",
    LANDINGPOINT: "LandingPoint",
    LOGICNODE: "LogicNode",
    LOGICLINK: "LogicLink",
    POP: "PoP",
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

var tmpViewType = VIEWTYPE.LOGICAL;
var tmpSubViewType = SUBVIEWTYPE.GLOBAL;

// point collection
const physicalNodeHeight = 0;
const phyNodeMinPixelSize = 8, phyNodeMaxPixelSize = 8;
const phyNodeMinScaleDist = 1e4, phyNodeMaxScaleDist = 8e6, phyNodeMinScaler = 1, phyNodeMaxScaler = 10;
const physicalNodeArray = [];
const physicalNodeCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
const physicalNodeLabelCollection = scene.primitives.add(new Cesium.LabelCollection());
const phyNodeLabelVisMinDistance = 0, phyNodeLabelVisMaxDistance = 100000;

// cluster parameters
const clusterDistance = 100;

// sabmarine cable collection
const subCableLineWidth = 3;
const subCableLineCollection = scene.primitives.add(new Cesium.PrimitiveCollection());

// land cable collection
const landCableLineWidth = 3;
const landCableLineCollection = scene.primitives.add(new Cesium.PrimitiveCollection());

// landing point collection
const landingPointHeight = 0, landingPointPixelSize = 4;
const landingPointMinScaleDist = 1e4, landingPointMaxScaleDist = 8e6, landingPointMinScaler = 1, landingPointMaxScaler = 10;
const landingPointCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());

// logic node collection
const logicNodeHeight = 100;
const logicNodeCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
const normalPixelSize = 4;
const minLogicNodePixelSize = 4, maxLogicNodePixelSize = 12, tier1PixelSize = 16;
const logicNodeOutlineWidth = 0.3;
const tier1AS = [3356, 1299, 2914, 6762, 3257, 6453, 6461, 3491, 5511, 12956, 3320, 701, 7018, 6830];
const logicNodeMinScaleDist = 1e4, logicNodeMaxScaleDist = 8e6, logicNodeMinScaler = 1, logicNodeMaxScaler = 10;
var minGlobalConeSize = undefined, maxGlobalConeSize = undefined;

// logic link collection
const logicLinkCollection = scene.primitives.add(new Cesium.PrimitiveCollection());
const p2cLinkIndex = 0, p2pLinkIndex = 1;
const logicLinkHeight = 0;
const minLogicLinkLineWidth = 1, maxLogicLinkLineWidth = 2, p2cLogicLinkAlpha = 0.1, p2pLogicLinkAlpha = 0.05;
const delayForLoadLogicLink = 5000;

// sub logic node collection
const subLogicNodeHeight = 0;
const subLogicNodeCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
const subTargetPixelSize = 12, subNormalPixelSize = 8, subTier1PixelSize = 16;
const subLogicNodeOutlineWidth = 1;
const subLogicNodeMinScaleDist = 1e4, subLogicNodeMaxScaleDist = 8e6, subLogicNodeMinScaler = 1, subLogicNodeMaxScaler = 10;

// sub logic link collection
const subLogicLinkCollection = scene.primitives.add(new Cesium.PrimitiveCollection());
const subP2CLinkIndex = 0, subP2PLinkIndex = 1;
const subLogicLinkHeight = 0;
const subMinLogicLinkLineWidth = 1.5, subMaxLogicLinkLineWidth = 2.5, subLogicLinkOutlineWidth = 0.5;
const subLogicLinkAlpha = 0.3;

// pop collection
const popCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
const popPixelSize = 4, popOutlineWidth = 0.5;
const popHeight = 200, facilityHeight = 150;
const popMinScaleDist = 1e4, popMaxScaleDist = 8e6, popMinScaler = 1, popMaxScaler = 10;
const subFacilityCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());
const facilityOutlineWidth = 0.5;
const subLandCableLineCollection = scene.primitives.add(new Cesium.PrimitiveCollection());
const directLinkCollection = scene.primitives.add(new Cesium.PrimitiveCollection());
const localLandCableLineWidth = 5;
const directLinkWidth = 3;

// tab view init timeout
const tabViewInitTimeout = 10000;

// flyHeight
const flyHeight = 1e6;

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

main();

function main()
{
    loadPhysicalNodes();
    loadSubmarineCables();
    loadLandingPointCollection();
    loadLandCables();
    loadLogicNodes();
    loadLogicLinks();
    setupEvent();
    tabController();
    toggleController();
    initSpecificASLogicSlidingBar();
    initSpecificASPhysicalSlidingBar();
    initSpecificASTupleLogicSlidingBar();
    initSpecificASTuplePhysicalSlidingBar();
    initQuery();
    setTimeout(initLogicalTabView, tabViewInitTimeout);
}

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
                nodeID = new ClusterNodeID(dataItem.index, PRIMTYPE.PHYNODE, dataItem.name, dataItem.organization, dataItem.latitude, dataItem.longitude, dataItem.city, dataItem.state, dataItem.country, dataItem.source, dataItem.date);
            }
            physicalNodeCollection.add({
                id : nodeID,
                show : true,
                position : position,
                pixelSize : phyNodeMinPixelSize + (phyNodeMaxPixelSize - phyNodeMinPixelSize) * (count - minCount) / (maxCount - minCount),
                color : Cesium.Color.CYAN,
                outlineColor : Cesium.Color.TRANSPARENT,
                outlineWidth : 0,
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
                        width: subCableLineWidth,
                    });
                    const cableInstance = new Cesium.GeometryInstance({
                        id: new SubmarineCableID(cable.id, PRIMTYPE.SUBCABLE, cable.name, cable.feature_id, cable.source, cable.date, index),
                        geometry: cableGeometry,
                        attributes: {
                            color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.MIDNIGHTBLUE),
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
        subCableLineCollection.add(new Cesium.GroundPolylinePrimitive({
            geometryInstances: cableInstances,
            appearance: new Cesium.PolylineColorAppearance(),
        }));
        subCableLineCollection.show = false;
    });
}

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
            const pointID = new LandingPointID(dataItem.index, PRIMTYPE.LANDINGPOINT, dataItem.city, dataItem.state, dataItem.country, dataItem.latitude, dataItem.longitude, dataItem.source, dataItem.date);
            landingPointCollection.add({
                id : pointID,
                position : position,
                pixelSize : landingPointPixelSize,
                color : Cesium.Color.WHITE,
                outlineColor : Cesium.Color.BLACK,
                outlineWidth : 1,
                scaleByDistance: new Cesium.NearFarScalar(landingPointMinScaleDist, landingPointMaxScaler, landingPointMaxScaleDist, landingPointMinScaler),
            });
        });
        landingPointCollection.show = false;
    });
}

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
                    width: subCableLineWidth,
                });
                const cableInstance = new Cesium.GeometryInstance({
                    id: new LandCableID(dataItem.index, PRIMTYPE.LANDCABLE, dataItem.from_city, dataItem.from_state, dataItem.from_country, dataItem.to_city, dataItem.to_state, dataItem.to_country, dataItem.distance, dataItem.date),
                    geometry: cableGeometry,
                    attributes: {
                        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.DARKORANGE),
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
            const pixelSize = minLogicNodePixelSize + parseInt((maxLogicNodePixelSize - minLogicNodePixelSize) * (cone_sizes[index] - minConeSize) / (maxConeSize - minConeSize));
            const color = tier1AS.includes(asn) ? Cesium.Color.DARKRED : Cesium.Color.DARKSLATEBLUE;
            logicNodeCollection.add({
                id : nodeID,
                show : true,
                position : position,
                pixelSize : pixelSize,
                color : color,
                outlineColor : Cesium.Color.BLACK,
                outlineWidth : logicNodeOutlineWidth,
                scaleByDistance: new Cesium.NearFarScalar(logicNodeMinScaleDist, logicNodeMaxScaler, logicNodeMaxScaleDist, logicNodeMinScaler),
            });
        });
        logicNodeCollection.show = false;
    });
}

function ajaxPromise(options) {
    return new Promise((resolve, reject) => {
        $.ajax(options).done(resolve).fail(reject);
    });
}

function loadLogicLinks() {
    console.log("loadLogicLinks begin...");
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
            let width = undefined, tier1InterConn = false;
            if (tier1AS.includes(srcAsn) && tier1AS.includes(dstAsn)) {
                width = maxLogicLinkLineWidth;
                tier1InterConn = true;
            }
            else {
                width = minLogicLinkLineWidth;
            }
            const logicLinkInstances = (linkType === "p2c")?p2cLogicLinkInstances:p2pLogicLinkInstances;
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
                    color: Cesium.Color.BLUE.withAlpha(p2cLogicLinkAlpha),
                })
            }),
        }));
        logicLinkCollection.add(new Cesium.Primitive({
            geometryInstances: p2pLogicLinkInstances,
            appearance: new Cesium.PolylineMaterialAppearance({
                translucent: true,
                material: Cesium.Material.fromType("Color", {
                    color: Cesium.Color.GREEN.withAlpha(p2pLogicLinkAlpha),
                })
            }),
        }));
        logicLinkCollection.get(p2cLinkIndex).show = false;
        logicLinkCollection.get(p2pLinkIndex).show = false;
    });
}

function setupMouseMoveEvent() {
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
    handler.setInputAction(function(movement) {
        const pickedObject = viewer.scene.pick(movement.endPosition);
        if (Cesium.defined(pickedObject) && Cesium.defined(pickedObject.id)) {
            switch(pickedObject.id.type) {
                case PRIMTYPE.PHYNODE:
                    infoBox.innerHTML = "<p>Facility: " + pickedObject.id.name + "<br>Organization: " + pickedObject.id.organization + "<br>City: " + pickedObject.id.city + "<br>State: " + pickedObject.id.state + "<br>Country: " + pickedObject.id.country + "</p>";
                    break;
                case PRIMTYPE.CLUSTERNODE:
                    infoBox.innerHTML = "<p>Facility: " + pickedObject.id.name + "<br>Organization: " + pickedObject.id.organization + "<br>City: " + pickedObject.id.city + "<br>State: " + pickedObject.id.state + "<br>Country: " + pickedObject.id.country + "</p>";
                    break;
                case PRIMTYPE.SUBCABLE:
                    infoBox.innerHTML = "<p>Submarine Cable: " + pickedObject.id.name + "<br>Feature ID: " + pickedObject.id.featureID + "</p>";
                    break;
                case PRIMTYPE.LANDCABLE:
                    infoBox.innerHTML = "<p>From: " + pickedObject.id.fromCity + ", " + pickedObject.id.fromState + ", " + pickedObject.id.fromCountry + "<br>To: " + pickedObject.id.toCity + ", " + pickedObject.id.toState + ", " + pickedObject.id.toCountry + "<br>Distance: " + pickedObject.id.distance + "</p>";
                    break;
                case PRIMTYPE.LANDINGPOINT:
                    infoBox.innerHTML = "<p>City: " + pickedObject.id.city + "<br>State: " + pickedObject.id.state + "<br>Country: " + pickedObject.id.country + "</p>";
                    break;
                case PRIMTYPE.LOGICNODE:
                    infoBox.innerHTML = "<p>ASN:" + pickedObject.id.asn + "<br>Name: " + pickedObject.id.name + "<br>Organization: " + pickedObject.id.organization + "</p>";
                    break;
                case PRIMTYPE.LOGICLINK:
                    infoBox.innerHTML = "<p>SRC: " + pickedObject.id.srcAsn + "<br>DST: " + pickedObject.id.dstAsn + "<br>Link Type: " + pickedObject.id.linkType + "</p>";
                    break;
                case PRIMTYPE.POP:
                    infoBox.innerHTML = "<p>ASN: " + pickedObject.id.asn + "<br>latitude: " + pickedObject.id.latitude + "<br>longitude: " + pickedObject.id.longitude + "</p>";
                    break;
                default:
                    infoBox.innerHTML = "Unknown";
                    break;
            }
            infoBox.style.display = 'block';
            infoBox.style.left = movement.endPosition.x + 'px';
            infoBox.style.top = movement.endPosition.y + 'px';
        } else {
            infoBox.innerHTML = "";
            infoBox.style.display = 'none';
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
}

function setupEvent() {
    setupMouseMoveEvent();
}

function asToggleController() {
    let asCheckBox = document.getElementById("as-checkbox");
    asCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                logicNodeCollection.show = (event.target.checked)?true:false;
                break;
            case SUBVIEWTYPE.LOCAL:
                subLogicNodeCollection.show = (event.target.checked)?true:false;
                break;
            default:
                break;
        }
    });
}

function p2pToggleController() {
    let p2pCheckBox = document.getElementById("p2p-checkbox");
    p2pCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                logicLinkCollection.get(p2pLinkIndex).show = (event.target.checked)?true:false;
                break;
            case SUBVIEWTYPE.LOCAL:
                subLogicLinkCollection.get(subP2PLinkIndex).show = (event.target.checked)?true:false;
                break;
            default:
                break;
        }
    });
}

function p2cToggleController() {
    let p2cCheckBox = document.getElementById("p2c-checkbox");
    p2cCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                logicLinkCollection.get(p2cLinkIndex).show = (event.target.checked)?true:false;
                break;
            case SUBVIEWTYPE.LOCAL:
                subLogicLinkCollection.get(subP2CLinkIndex).show = (event.target.checked)?true:false;
                break;
            default:
                break;
        }
    });
}

function facilityToggleController() {
    let facilityCheckBox = document.getElementById("facility-checkbox");
    facilityCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                physicalNodeCollection.show = (event.target.checked)?true:false;
                physicalNodeLabelCollection.show = (event.target.checked)?true:false;
                break;
            case SUBVIEWTYPE.LOCAL:
                // Todo: physical local view
                physicalNodeCollection.show = (event.target.checked)?true:false;
                physicalNodeLabelCollection.show = (event.target.checked)?true:false;
                break;
            default:
                break;
        }
    });
}

function submarineCableToggleController() {
    let subCableCheckBox = document.getElementById("submarine-cable-checkbox");
    subCableCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                subCableLineCollection.show = (event.target.checked)?true:false;
                break;
            case SUBVIEWTYPE.LOCAL:
                // Todo: submarine cable local view
                subCableLineCollection.show = (event.target.checked)?true:false;
                break;
            default:
                break;
        }
    });
}

function landingPointToggleController() {
    let landingPointCheckBox = document.getElementById("landing-points-checkbox");
    landingPointCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                landingPointCollection.show = (event.target.checked)?true:false;
                break;
            case SUBVIEWTYPE.LOCAL:
                // Todo: landing point local view
                landingPointCollection.show = (event.target.checked)?true:false;
                break;
            default:
                break;
        }
    });
}

function landCableToggleController() {
    let landCableCheckBox = document.getElementById("long-haul-cable-checkbox");
    landCableCheckBox.addEventListener("change", function(event) {
        switch(tmpSubViewType) {
            case SUBVIEWTYPE.GLOBAL:
                landCableLineCollection.show = (event.target.checked)?true:false;
                break;
            case SUBVIEWTYPE.LOCAL:
                // Todo: land cable local view
                landCableLineCollection.show = (event.target.checked)?true:false;
                break;
            default:
                break;
        }
    });
}

function toggleController() {
    asToggleController();
    p2cToggleController();
    p2pToggleController();
    facilityToggleController();
    submarineCableToggleController();
    landingPointToggleController();
    landCableToggleController();
}

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

function logicalTablController() {
    clearLocalView();
    setToggleState("as-checkbox", true);
    setToggleState("p2p-checkbox", true);
    setToggleState("p2c-checkbox", true);
    setToggleState("facility-checkbox", false);
    setToggleState("submarine-cable-checkbox", false);
    setToggleState("landing-points-checkbox", false);
    setToggleState("long-haul-cable-checkbox", false);
}

function physicalTabController() {
    clearLocalView();
    setToggleState("as-checkbox", false);
    setToggleState("p2p-checkbox", false);
    setToggleState("p2c-checkbox", false);
    setToggleState("facility-checkbox", true);
    setToggleState("submarine-cable-checkbox", true);
    setToggleState("landing-points-checkbox", true);
    setToggleState("long-haul-cable-checkbox", false);
}

function tabController() {
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
                    tmpViewType = VIEWTYPE.LOGICAL;
                    tmpSubViewType = SUBVIEWTYPE.GLOBAL;
                    logicalTablController();
                    break;
                case "physical":
                    tmpViewType = VIEWTYPE.PHYSICAL;
                    tmpSubViewType = SUBVIEWTYPE.GLOBAL;
                    physicalTabController();
                    break;
                default:
                    break;
            }
        });
    });
}

function initLogicalTabView() {
    let button = document.getElementById("logical-button");
    const event = new Event('click', { bubbles: true });
    button.dispatchEvent(event);
}

function initPhysicalTabView() {
    let button = document.getElementById("physical-button");
    const event = new Event('click', { bubbles: true });
    button.dispatchEvent(event);
}

function initQuery() {
    $('#searchBox').on('keypress', function(e) {
        if (e.which === 13) {
            var input = $(this).val().trim();
            if (input.includes('-')) {
                var regex = /^AS\d+-AS\d+$/; // 正则表达式：AS数字-AS数字
                if (regex.test(input)) {
                    var asns = input.split('-');
                    var asn1 = parseInt(asns[0].replace("AS", ""), 10);
                    var asn2 = parseInt(asns[1].replace("AS", ""), 10);
                    if (isNaN(asn1) || isNaN(asn2)) {
                        alert("Invalid input: " + input + ". Please input like this: AS3356-AS1299.");
                        return;
                    }
                    queryASTuple(asn1, asn2);
                }
                else {
                    alert("Invalid input: " + input + ". Please input like this: AS3356-AS1299.");
                }
            }
            else {
                var regex = /^AS\d+$/;
                if (regex.test(input)) {
                    var asn = parseInt(input.replace("AS", ""), 10);
                    if (isNaN(asn)) {
                        alert("Invalid input: " + input + ". Please input like this: AS3356.");
                        return;
                    }
                    querySpecificAS(asn);
                }
                else {
                    alert("Invalid input: " + input + ". Please input like this: AS3356.");
                }
            }
        }
    });
}

function initSpecificASLogicSlidingBar() {
    const closeSlidingbarBtn = document.getElementById('closeSlidingbar');
    closeSlidingbarBtn.addEventListener('click', () => {
        const slidingbar = document.getElementById('slidingbar');
        slidingbar.classList.remove('open');
        subLogicNodeCollection.removeAll();
        subLogicLinkCollection.removeAll();
        subLogicNodeCollection.show = false;
        subLogicLinkCollection.show = false;
        initLogicalTabView();
    });
}

function setSpecificASLogicSlidingBarBaseInfo(_title, _asn, _name, _organization, _country, _cone_size, _cone_prefix_size, _degree_provider, _degree_peer, _degree_customer, _prefix_size) {
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

function setSpecificASLogicNeighborList(neighborListData) {
    
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

function querySpecificASLogic(asn) {

    closeSlidingBar();
    tmpSubViewType = SUBVIEWTYPE.LOCAL;
    logicNodeCollection.show = false;
    logicLinkCollection.get(p2cLinkIndex).show = false;
    logicLinkCollection.get(p2pLinkIndex).show = false;
    subLogicLinkCollection.removeAll();
    subLogicNodeCollection.removeAll();
    const neighborListData = [];

    function addSingleNode(index, asn, name, organization, latitude, longitude, cone_size, isSearchTarget) {
        let pixelSize = undefined, color = undefined;
        if (isSearchTarget) {
            color = Cesium.Color.RED;
        }
        else {
            color = tier1AS.includes(asn) ? Cesium.Color.DARKRED : Cesium.Color.DARKSLATEBLUE;
        }
        pixelSize = minLogicNodePixelSize + parseInt((maxLogicNodePixelSize - minLogicNodePixelSize) * (Math.log(cone_size) - minGlobalConeSize) / (maxGlobalConeSize - minGlobalConeSize));
        subLogicNodeCollection.add({
            id : new LogicNodeID(index, PRIMTYPE.LOGICNODE, asn, name, organization),
            position : Cesium.Cartesian3.fromDegrees(longitude, latitude, subLogicNodeHeight),
            pixelSize : pixelSize,
            color : color,
            outlineColor : Cesium.Color.BLACK,
            outlineWidth : subLogicNodeOutlineWidth,
            scaleByDistance: new Cesium.NearFarScalar(subLogicNodeMinScaleDist, subLogicNodeMaxScaler, subLogicNodeMaxScaleDist, subLogicNodeMinScaler),
        });
    }

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
        setSpecificASLogicSlidingBarBaseInfo("AS" + asn + "详细信息", data[0].asn, data[0].name, data[0].organization, data[0].country, data[0].cone_size, data[0].cone_prefix_size, data[0].degree_provider, data[0].degree_peer, data[0].degree_customer, data[0].prefix_size);
        // camera.flyTo({
        //     destination: Cesium.Cartesian3.fromDegrees(data[0].longitude, data[0].latitude, flyHeight)
        // });
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
                width = subMaxLogicLinkLineWidth;
            }
            else {
                width = subMinLogicLinkLineWidth;
            }
            const logicLinkInstances = (linkType === "p2c")?p2cLogicLinkInstances:p2pLogicLinkInstances;
            logicLinkInstances.push(new Cesium.GeometryInstance({
                id: new LogicLinkID(dataItem.index, PRIMTYPE.LOGICLINK, srcIdx, dstIdx, srcAsn, dstAsn, linkType),
                geometry: new Cesium.PolylineGeometry({
                    vertexFormat : Cesium.VertexFormat.POSITION_ONLY,
                    positions: Cesium.Cartesian3.fromDegreesArrayHeights([src_lon, src_lat, subLogicLinkHeight, dst_lon, dst_lat, subLogicLinkHeight]),
                    width: width,
                }),
            }));
        });
        subLogicLinkCollection.add(new Cesium.Primitive({
            geometryInstances: p2cLogicLinkInstances,
            appearance: new Cesium.PolylineMaterialAppearance({
                translucent: true,
                material: Cesium.Material.fromType("Color", {
                    color: Cesium.Color.BLUE.withAlpha(subLogicLinkAlpha),
                })
            }),
        }));
        subLogicLinkCollection.add(new Cesium.Primitive({
            geometryInstances: p2pLogicLinkInstances,
            appearance: new Cesium.PolylineMaterialAppearance({
                translucent: true,
                material: Cesium.Material.fromType("Color", {
                    color: Cesium.Color.GREEN.withAlpha(subLogicLinkAlpha),
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
        subLogicNodeCollection.show = true;
        subLogicLinkCollection.show = true;
        setSpecificASLogicNeighborList(neighborListData);
        showSpecificASLogicSlidingBar();
        setToggleState("as-checkbox", true);
        setToggleState("p2p-checkbox", true);
        setToggleState("p2c-checkbox", true);
    });
}

function initSpecificASPhysicalSlidingBar() {
    const closeSlidingbarBtn = document.getElementById('closeSlidingbar2');
    closeSlidingbarBtn.addEventListener('click', () => {
        const slidingbar = document.getElementById('slidingbar2');
        slidingbar.classList.remove('open');
        popCollection.removeAll();
        subFacilityCollection.removeAll();
        directLinkCollection.removeAll();
        popCollection.show = false;
        subFacilityCollection.show = false;
        directLinkCollection.show = false;
        initPhysicalTabView();
    });
}

function showSpecificASPhysicalSlidingBar() {
    const slidingbar = document.getElementById('slidingbar2');
    slidingbar.classList.add('open');
}

function setSpecificASPhysicalSlidingBarInfo(asn, pops, facilities, queryData) {

    function findFacilityByID(facilityID, qData) {
        let res = undefined;
        for (let i=0; i<qData.length; i++) {
            if (qData[i].index === facilityID) {
                res = qData[i];
                break;
            }
        }
        return res;
    }

    const slidingbarTitle = document.getElementById('slidingbar2-title');
    slidingbarTitle.textContent = "AS" + asn + " PoP信息";

    const slidingBarContent = document.getElementById('slidingbar2-content');
    slidingBarContent.innerHTML = '';

    pops.forEach((pop, index) => {
        const table = document.createElement('table');
        const row1 = table.insertRow();
        const th1 = document.createElement('th');
        th1.textContent = 'PoP';
        row1.appendChild(th1);
        const td1 = document.createElement('td');
        td1.textContent = `${pop[0]},${pop[1]}`;
        td1.style.cursor = 'pointer'; // Make it look clickable
        td1.addEventListener('click', () => {
            // Call CesiumJS camera flyTo method
            if (camera) {
                camera.flyTo({
                    destination: Cesium.Cartesian3.fromDegrees(pop[1], pop[0], flyHeight) // Adjust height as needed
                });
            } else {
                alert('Cesium viewer is not initialized.');
            }
        });
        row1.appendChild(td1);

        const divider = document.createElement('hr');
        slidingBarContent.appendChild(divider);

        // Facility row
        const row2 = table.insertRow();
        const th2 = document.createElement('th');
        th2.textContent = 'Facility';
        row2.appendChild(th2);
        const td2 = document.createElement('td');
        const facility = findFacilityByID(facilities[index], queryData);
        td2.textContent =  facility ? facility.name : 'Unknown';
        row2.appendChild(td2);

        if (facility) {
            // Additional rows if facility exists
            const row3 = table.insertRow();
            const th3 = document.createElement('th');
            th3.textContent = 'Organization';
            row3.appendChild(th3);
            const td3 = document.createElement('td');
            td3.textContent = facility.organization;
            row3.appendChild(td3);

            const row4 = table.insertRow();
            const th4 = document.createElement('th');
            th4.textContent = 'City';
            row4.appendChild(th4);
            const td4 = document.createElement('td');
            td4.textContent = facility.city;
            row4.appendChild(td4);

            const row5 = table.insertRow();
            const th5 = document.createElement('th');
            th5.textContent = 'State';
            row5.appendChild(th5);
            const td5 = document.createElement('td');
            td5.textContent = facility.state;
            row5.appendChild(td5);

            const row6 = table.insertRow();
            const th6 = document.createElement('th');
            th6.textContent = 'Region';
            row6.appendChild(th6);
            const td6 = document.createElement('td');
            td6.textContent = facility.country;
            row6.appendChild(td6);
        }
        slidingBarContent.appendChild(table);
    });
}

function querySpecificASPhysical(asn) {
    // Todo
    closeSlidingBar();
    tmpSubViewType = SUBVIEWTYPE.LOCAL;
    popCollection.removeAll();
    subFacilityCollection.removeAll();
    directLinkCollection.removeAll();
    subLandCableLineCollection.removeAll();

    const popPos = [];
    const popIds = [];
    const popMap = new Map();

    const facilityIds = [];
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
        const facilitys = [];
        data.forEach(dataItem => {
            popPos.push([dataItem.latitude, dataItem.longitude]);
            facilityIds.push(dataItem.facility_id);
            if (dataItem.facility_id !== -1) {facilitys.push(dataItem.facility_id);}
            popMap.set(dataItem.index, dataItem);
            popIds.push(dataItem.index);
        });
        const params = facilitys.join(",");
        return ajaxPromise({
            url: baseURL + "/physical-nodes/detail",
            method: ajaxMethod,
            data: {idxs: params},
            timeout: ajaxTimeout,
            dataType: ajaxDataType
        });
    }).then(function(response) {
        if (response === undefined) {initPhysicalTabView(); return;}
        const data = response.data, dataLength = data.length, status = response.status, message = response.message;
        if (status !== "ok") {
            console.error("Failed to load physical nodes: " + message);
            return;
        }
        if (dataLength === 0) {initPhysicalTabView(); return;}

        data.forEach(dataItem => {
            const position = Cesium.Cartesian3.fromDegrees(dataItem.longitude, dataItem.latitude, facilityHeight);
            const nodeID = new PhysicalNodeID(dataItem.index, PRIMTYPE.PHYNODE, dataItem.name, dataItem.organization, dataItem.latitude, dataItem.longitude, dataItem.city, dataItem.state, dataItem.country, dataItem.source, dataItem.date);
            subFacilityCollection.add({
                id : nodeID,
                position : position,
                pixelSize : phyNodeMinPixelSize,
                color : Cesium.Color.RED,
                outlineColor : Cesium.Color.BLACK,
                outlineWidth : facilityOutlineWidth,
                scaleByDistance : new Cesium.NearFarScalar(phyNodeMinScaleDist, phyNodeMaxScaler, phyNodeMaxScaleDist, phyNodeMinScaler),
            });
            facilityMap.set(dataItem.index, dataItem);
            facilityId2Angle.set(dataItem.index, 0);
        });

        const directLinkInstances = [];
        popIds.forEach(popId => {
            const popItem = popMap.get(popId);
            const popFacilityId = popItem.facility_id;
            const radius = 50000;
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
                color : Cesium.Color.Blue,
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
                    width: directLinkWidth,
                });
                const linkInstance = new Cesium.GeometryInstance({
                    geometry: linkGeometry,
                    attributes: {
                        color: Cesium.ColorGeometryInstanceAttribute.fromColor(Cesium.Color.RED),
                    }
                });
                directLinkInstances.push(linkInstance);
            }
        });
        directLinkCollection.add(new Cesium.Primitive({
            geometryInstances: directLinkInstances,
            appearance: new Cesium.PolylineColorAppearance({
                translucent: true,
            }),
        }));

        popCollection.show = true;
        subFacilityCollection.show = true;
        directLinkCollection.show = true;
        setSpecificASPhysicalSlidingBarInfo(asn, popPos, facilityIds, data);
        showSpecificASPhysicalSlidingBar();
    });
}

function querySpecificAS(asn) {
    switch(tmpViewType) {
        case VIEWTYPE.LOGICAL:
            querySpecificASLogic(asn);
            break;
        case VIEWTYPE.PHYSICAL:
            querySpecificASPhysical(asn);
            break;
        default:
            break;
    }
}

function setSpecificASTupleLogicSlidingBarBaseInfo(srcNode, dstNode, link_type) {
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

function showSpecificASTupleLogicSlidingBar() {
    document.getElementById('slidingbar3').classList.add('open');
}

function initSpecificASTupleLogicSlidingBar() {
    const closeSlidingbarBtn = document.getElementById('closeSlidingbar3');
    closeSlidingbarBtn.addEventListener('click', () => {
        document.getElementById('slidingbar3').classList.remove('open');
        subLogicNodeCollection.removeAll();
        subLogicLinkCollection.removeAll();
        subLogicNodeCollection.show = false;
        subLogicLinkCollection.show = false;
        initLogicalTabView();
    });
}

function queryASTupleLogic(asn1, asn2) {
    closeSlidingBar();
    tmpSubViewType = SUBVIEWTYPE.LOCAL;
    logicNodeCollection.show = false;
    logicLinkCollection.get(p2cLinkIndex).show = false;
    logicLinkCollection.get(p2pLinkIndex).show = false;
    subLogicLinkCollection.removeAll();
    subLogicNodeCollection.removeAll();
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
        subLogicNodeCollection.add({
            id : new LogicNodeID(srcNode.index, PRIMTYPE.LOGICNODE, srcNode.asn, srcNode.name, srcNode.organization),
            position : Cesium.Cartesian3.fromDegrees(srcNode.longitude, srcNode.latitude, subLogicNodeHeight),
            pixelSize : tier1AS.includes(srcNode.asn) ? subTier1PixelSize : subTargetPixelSize,
            color : tier1AS.includes(srcNode.asn) ? Cesium.Color.DARKRED : Cesium.Color.DARKSLATEBLUE,
            outlineColor : Cesium.Color.BLACK,
            outlineWidth : subLogicNodeOutlineWidth,
            scaleByDistance: new Cesium.NearFarScalar(subLogicNodeMinScaleDist, subLogicNodeMaxScaler, subLogicNodeMaxScaleDist, subLogicNodeMinScaler),
        });
        subLogicNodeCollection.add({
            id : new LogicNodeID(dstNode.index, PRIMTYPE.LOGICNODE, dstNode.asn, dstNode.name, dstNode.organization),
            position : Cesium.Cartesian3.fromDegrees(dstNode.longitude, dstNode.latitude, subLogicNodeHeight),
            pixelSize : tier1AS.includes(dstNode.asn) ? subTier1PixelSize : subTargetPixelSize,
            color : tier1AS.includes(dstNode.asn) ? Cesium.Color.DARKRED : Cesium.Color.DARKSLATEBLUE,
            outlineColor : Cesium.Color.BLACK,
            outlineWidth : subLogicNodeOutlineWidth,
            scaleByDistance: new Cesium.NearFarScalar(subLogicNodeMinScaleDist, subLogicNodeMaxScaler, subLogicNodeMaxScaleDist, subLogicNodeMinScaler),
        });
        const p2clogicLinkInstances = [], p2plogicLinkInstances = [];
        const logicLinkInstances = (link_type === "p2c")?p2clogicLinkInstances:p2plogicLinkInstances;
        logicLinkInstances.push(new Cesium.GeometryInstance({
            id: new LogicLinkID(linkIndex, PRIMTYPE.LOGICLINK, srcNode.index, dstNode.index, srcNode.asn, dstNode.asn, link_type),
            geometry: new Cesium.PolylineGeometry({
                vertexFormat : Cesium.VertexFormat.POSITION_ONLY,
                positions: Cesium.Cartesian3.fromDegreesArrayHeights([srcPos[1], srcPos[0], subLogicLinkHeight, dstPos[1], dstPos[0], subLogicLinkHeight]),
                width: tier1AS.includes(srcNode.asn) && tier1AS.includes(dstNode.asn) ? subMaxLogicLinkLineWidth : subMinLogicLinkLineWidth,
            }),
        }));
        subLogicLinkCollection.add(new Cesium.Primitive({
            geometryInstances: p2clogicLinkInstances,
            appearance: new Cesium.PolylineMaterialAppearance({
                translucent: true,
                material: Cesium.Material.fromType("Color", {
                    color: Cesium.Color.BLUE.withAlpha(subLogicLinkAlpha),
                })
            }),
        }));
        subLogicLinkCollection.add(new Cesium.Primitive({
            geometryInstances: p2plogicLinkInstances,
            appearance: new Cesium.PolylineMaterialAppearance({
                translucent: true,
                material: Cesium.Material.fromType("Color", {
                    color: Cesium.Color.GREEN.withAlpha(subLogicLinkAlpha),
                })
            }),
        }));
        subLogicNodeCollection.show = true;
        subLogicLinkCollection.show = true;
        setSpecificASTupleLogicSlidingBarBaseInfo(srcNode, dstNode, link_type);
        showSpecificASTupleLogicSlidingBar();
    });
}

function queryASTuplePhysical(asn1, asn2) {

    function adjustPoPFacility(popItem1, popItem2, facilityMap) {
        const facilityId1 = popItem1.facility_id, facilityId2 = popItem2.facility_id;
        if (facilityId1 !== -1 && facilityId2 !== -1) {
            const facilityItem1 = facilityMap.get(facilityId1), facilityItem2 = facilityMap.get(facilityId2);
            const sourceLat = facilityItem1.latitude, sourceLon = facilityItem1.longitude;
            const targetLat = facilityItem2.latitude, targetLon = facilityItem2.longitude;
            const threshold = 5; // km
            if (areCoordinatesNear(sourceLat, sourceLon, targetLat, targetLon, threshold)) {
                return [facilityId1, facilityId1];
            }
        }
        return [facilityId1, facilityId2];
    }

    closeSlidingBar();
    tmpSubViewType = SUBVIEWTYPE.LOCAL;
    popCollection.removeAll();
    subFacilityCollection.removeAll();
    subLandCableLineCollection.removeAll();
    directLinkCollection.removeAll();

    const phyLinkIds = [];
    const linkCableIds = new Array();

    const popIds = new Set();
    const facilityIds = new Set();
    const cityIds = new Set();
    const cableIds = new Set();
    
    const popMap = new Map();
    const facilityMap = new Map();
    const cableMap = new Map();
    const cityMap = new Map();

    function fromRandomDark(options) {
        options = Cesium.defaultValue(options, {});
        options.maximumRed = Cesium.defaultValue(options.maximumRed, 0.5);
        options.maximumGreen = Cesium.defaultValue(options.maximumGreen, 0.5);
        options.maximumBlue = Cesium.defaultValue(options.maximumBlue, 0.5);
        return Cesium.Color.fromRandom(options);
    }
        
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
            phyLinkIds.push([dataItem.src_pop_index, dataItem.dst_pop_index]);
            popIds.add(dataItem.src_pop_index);
            popIds.add(dataItem.dst_pop_index);
            const cable_ids = dataItem.cable_ids;
            linkCableIds.push(cable_ids);
            cable_ids.forEach(cable_id => {
                cableIds.add(cable_id);
            });
        });

        const params = Array.from(popIds).join(",");
        return ajaxPromise({
            url: baseURL + "/pop/detail",
            method: ajaxMethod,
            data: {idxs: params},
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
            if (dataItem.facility_id !== -1) { facilityIds.add(dataItem.facility_id); }
            if (dataItem.city_id !== -1) { cityIds.add(dataItem.city_id); }
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
        if (dataLength === 0) {
            return;
        }
        data.forEach(dataItem => {
            facilityMap.set(dataItem.index, dataItem);
            const position = Cesium.Cartesian3.fromDegrees(dataItem.longitude, dataItem.latitude, facilityHeight);
            const nodeID = new PhysicalNodeID(dataItem.index, PRIMTYPE.PHYNODE, dataItem.name, dataItem.organization, dataItem.latitude, dataItem.longitude, dataItem.city, dataItem.state, dataItem.country, dataItem.source, dataItem.date);
            subFacilityCollection.add({
                id : nodeID,
                position : position,
                pixelSize : phyNodeMaxPixelSize,
                color : Cesium.Color.RED,
                outlineColor : Cesium.Color.BLACK,
                outlineWidth : facilityOutlineWidth,
                scaleByDistance : new Cesium.NearFarScalar(phyNodeMinScaleDist, phyNodeMaxScaler, phyNodeMaxScaleDist, phyNodeMinScaler),
            });
        });

        return ajaxPromise({
            url: baseURL + "/land-cables/detail",
            method: ajaxMethod,
            data: {idxs: Array.from(cableIds).join(",")},
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
        if (dataLength === 0) { return; }
        
        data.forEach(dataItem => {
            cableMap.set(dataItem.index, dataItem);
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
        if (status !== "ok" && cityIds.length !== 0) {
            console.error("Failed to load land cables: " + message);
            return;
        }
        if (dataLength === 0 && cityIds.length !== 0) { return; }
        data.forEach(dataItem => {
            cityMap.set(dataItem.index, dataItem);
        });

        const radius = 50000; // m
        const facilityId2Angle = new Map();
        const cityId2Angle = new Map();

        facilityIds.forEach(facilityId => {
            facilityId2Angle.set(facilityId, 0);
        });
        cityIds.forEach(cityId => {
            cityId2Angle.set(cityId, 0);
        });

        const popDrawFlag = new Map();
        const directLinkInstances = [];
        const colorList = generateCielabColors(phyLinkIds.length);
        phyLinkIds.forEach((link, linkIndex) => {
            const color = Cesium.Color.fromCssColorString(colorList[linkIndex]);
            const srcPoPIndex = link[0], dstPoPIndex = link[1];
            const facilityIdTuple = adjustPoPFacility(popMap.get(srcPoPIndex), popMap.get(dstPoPIndex), facilityMap);
            const srcFacilityId = facilityIdTuple[0], dstFacilityId = facilityIdTuple[1];
            if (!popDrawFlag.has(srcPoPIndex)) {
                drawPoP(srcPoPIndex, srcFacilityId, popMap, facilityMap, cityMap, facilityId2Angle, cityId2Angle, radius, color, directLinkInstances);
                popDrawFlag.set(srcPoPIndex, true);
            }
            if (!popDrawFlag.has(dstPoPIndex)) {
                drawPoP(dstPoPIndex, dstFacilityId, popMap, facilityMap, cityMap, facilityId2Angle, cityId2Angle, radius, color, directLinkInstances);
                popDrawFlag.set(dstPoPIndex, true);
            }
            const relatedCableIds = linkCableIds[linkIndex];
            const cableInstances = [];
            relatedCableIds.forEach(cableId => {
                const cableItem = cableMap.get(cableId);
                const coordinates = cableItem.coordinates;
                const cableDegrees = coordinates.flat();
                const cablePositions = Cesium.Cartesian3.fromDegreesArray(cableDegrees);
                const cableGeometry = new Cesium.GroundPolylineGeometry({
                    positions: cablePositions,
                    width: localLandCableLineWidth,
                });
                cableInstances.push(new Cesium.GeometryInstance({
                    geometry: cableGeometry,
                    attributes: {
                        color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
                    },
                }));
            });
            subLandCableLineCollection.add(new Cesium.GroundPolylinePrimitive({
                geometryInstances: cableInstances,
                appearance: new Cesium.PolylineColorAppearance(),
            }));
        });
        directLinkCollection.add(new Cesium.Primitive({
            geometryInstances: directLinkInstances,
            appearance: new Cesium.PolylineColorAppearance(),
        }));

        popCollection.show = true;
        directLinkCollection.show = true;
        subFacilityCollection.show = true;
        subLandCableLineCollection.show = true;

        setToggleState("facility-checkbox", false);
        setToggleState("submarine-cable-checkbox", false);
        setToggleState("landing-points-checkbox", false);
        setToggleState("long-haul-cable-checkbox", false);

        setSpecificASTuplePhysicalSlidingBarInfo(phyLinkIds, popMap, facilityMap, asn1, asn2);
        showSpecificASTuplePhysicalSlidingBar();
    });
}

function drawPoP(popIndex, facilityID, popMap, facilityMap, cityMap, facilityId2Angle, cityId2Angle, radius, color, directLinkInstances) {
    const alphaOffset = 45;
    const popItem = popMap.get(popIndex);
    let  popCoordinate = undefined;
    let sourceLat = undefined, sourceLon = undefined;
    if (facilityID !== -1) {
        const facilityItem = facilityMap.get(facilityID);
        popCoordinate = getPoPCoordinate({latitude: facilityItem.latitude, longitude: facilityItem.longitude}, facilityId2Angle.get(facilityID), radius);
        facilityId2Angle.set(facilityID, facilityId2Angle.get(facilityID) + alphaOffset);
        sourceLat = facilityItem.latitude, sourceLon = facilityItem.longitude;
    }
    else {
        const cityID = popItem.city_id;
        const cityItem = cityMap.get(cityID);
        popCoordinate = getPoPCoordinate({latitude: cityItem.latitude, longitude: cityItem.longitude}, cityId2Angle.get(cityID), radius);
        cityId2Angle.set(cityID, cityId2Angle.get(cityID) + alphaOffset);
        sourceLat = cityItem.latitude, sourceLon = cityItem.longitude;
    }
    const position = Cesium.Cartesian3.fromDegrees(popCoordinate.longitude, popCoordinate.latitude, popHeight);
    const popID = new PoPID(popItem.index, PRIMTYPE.POP, popItem.asn, popCoordinate.latitude, popCoordinate.longitude, popItem.facility_id, popItem.city_id, popItem.landing_point_id, popItem.distance);
    popCollection.add({
        id: popID,
        show: true,
        position: position,
        pixelSize: popPixelSize,
        color: color,
        outlineColor: Cesium.Color.BLACK,
        outlineWidth: popOutlineWidth,
        scaleByDistance: new Cesium.NearFarScalar(popMinScaleDist, popMaxScaler, popMaxScaleDist, popMinScaler),
    });
    const linkGeomotry = new Cesium.PolylineGeometry({
        width: directLinkWidth,
        positions: Cesium.Cartesian3.fromDegreesArray([sourceLon, sourceLat, popCoordinate.longitude, popCoordinate.latitude]),
    });
    directLinkInstances.push(new Cesium.GeometryInstance({
        geometry: linkGeomotry,
        attributes: {
            color: Cesium.ColorGeometryInstanceAttribute.fromColor(color),
        },
    }));
}

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

function setSpecificASTuplePhysicalSlidingBarInfo(phyLinkIds, popMap, facilityMap, asn1, asn2) {

    function addPoP(table, popIndex, lIndex) {
        const latitude1 = popMap.get(popIndex).latitude, longitude1 = popMap.get(popIndex).longitude;
        const pop1Row = table.insertRow();
        const pop1Header = document.createElement('th');
        pop1Header.textContent = `PoP${lIndex}`;
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
        asnHeader.textContent = `ASN${lIndex}`;
        asnRow.appendChild(asnHeader);
        const asnData = document.createElement('td');
        asnData.textContent = asn;
        asnRow.appendChild(asnData);
    }

    function addFacility(table, popIndex, lIndex) {
        const facility1Row = table.insertRow();
        const facility1Header = document.createElement('th');
        facility1Header.textContent = `facility${lIndex}`;
        facility1Row.appendChild(facility1Header);
        const facility1Data = document.createElement('td');
        if (popMap.get(popIndex).facility_id !== -1) {
            const facility = facilityMap.get(popMap.get(popIndex).facility_id);
            facility1Data.textContent = facility.name;
        } else {
            facility1Data.textContent = 'unknown';
        }
        facility1Row.appendChild(facility1Data);
    }

    function addLocation(table, popIndex, lIndex) {
        const location1Row = table.insertRow();
        const location1Header = document.createElement('th');
        location1Header.textContent = `location${lIndex}`;
        location1Row.appendChild(location1Header);
        const location1Data = document.createElement('td');
        if (popMap.get(popIndex).facility_id !== -1) {
            const facility = facilityMap.get(popMap.get(popIndex).facility_id);
            location1Data.textContent = `${facility.city}, ${facility.state}, ${facility.country}`;
        }
        else {
            location1Data.textContent = 'unknown';
        }
        location1Row.appendChild(location1Data);
    }

    const slidingbarTitle = document.getElementById('slidingbar4-title');
    slidingbarTitle.textContent = "AS" + asn1 + " - AS" + asn2 + " 互联信息";
    const slidingbar4Content = document.getElementById('slidingbar4Content');
    slidingbar4Content.innerHTML = '';
    phyLinkIds.forEach((link, index) => {
        const table = document.createElement('table');

        // Link Index Row (Span 2 columns)
        const linkIndexRow = table.insertRow();
        const linkIndexCell = document.createElement('th');
        linkIndexCell.textContent = `link ${index + 1}`;
        linkIndexCell.colSpan = 2;
        linkIndexCell.className = 'link-index';
        linkIndexRow.appendChild(linkIndexCell);
        
        for (let i = 1; i < 3; i++) {
            addPoP(table, link[i-1], i);
            addASN(table, link[i-1], i);
            addFacility(table, link[i-1], i);
            addLocation(table, link[i-1], i);
        }
        slidingbar4Content.appendChild(table);
    });
}

function showSpecificASTuplePhysicalSlidingBar() {
    const slidingbar = document.getElementById('slidingbar4');
    slidingbar.classList.add('open');
}

function initSpecificASTuplePhysicalSlidingBar() {
    const closeSlidingbarBtn = document.getElementById('closeSlidingbar4');
    closeSlidingbarBtn.addEventListener('click', () => {
        const slidingbar = document.getElementById('slidingbar4');
        slidingbar.classList.remove('open');
        popCollection.removeAll();
        subFacilityCollection.removeAll();
        subLandCableLineCollection.removeAll();
        directLinkCollection.removeAll();
        popCollection.show = false;
        subFacilityCollection.show = false;
        subLandCableLineCollection.show = false;
        directLinkCollection.show = false;
        initPhysicalTabView();
    });
}

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

function closeSlidingBar() {
    const slidingBarIds = ['slidingbar', 'slidingbar2', 'slidingbar3', 'slidingbar4'];
    const closeButtonIds = ['closeSlidingbar', 'closeSlidingbar2', 'closeSlidingbar3', 'closeSlidingbar4'];
    closeButtonIds.forEach((id, index) => {
        const slidingBar = document.getElementById(slidingBarIds[index]);
        // const closeSlidingbarBtn = document.getElementById(id);
        if (slidingBar.classList.contains('open')) { slidingBar.classList.remove('open'); }
    });
}

function clearLocalView() {

    closeSlidingBar();

    subLogicNodeCollection.removeAll();
    subLogicNodeCollection.show = false;

    subLogicLinkCollection.removeAll();
    subLogicLinkCollection.show = false;

    popCollection.removeAll();
    popCollection.show = false;

    subFacilityCollection.removeAll();
    subFacilityCollection.show = false;
    
    subLandCableLineCollection.show = false;
    subLandCableLineCollection.removeAll();

    directLinkCollection.show = false;
    directLinkCollection.removeAll();
}

function generateCielabColors(n) {
    const colors = [];
    for (let i = 0; i < n; i++) {
        const l = 70; // 亮度
        const a = Math.cos((i / n) * 2 * Math.PI) * 50; // a 分量
        const b = Math.sin((i / n) * 2 * Math.PI) * 50; // b 分量
        const color = chroma.lab(l, a, b).hex(); // 转换为 RGB
        colors.push(color);
    }
    return colors;
}
