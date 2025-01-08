// Configure Cesium
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxM2MyODI3Zi0yZGIzLTRlOTMtYjg3My0yOGMyYTYxM2U1NjAiLCJpZCI6MjYwODAzLCJpYXQiOjE3MzM3MDgyNjh9.FY-d2_kcOZ4zQOaNZL3_Ta1CFrnb7bB3Rn8C8jsHu3E';
var mapboxStyleId = "light-v11";
const mapbox = new Cesium.MapboxStyleImageryProvider({
    styleId: mapboxStyleId,
    accessToken: 'pk.eyJ1IjoibXE5NTEwMDkiLCJhIjoiY20zczV6bDFqMGN0dzJqczFqM3lkYjJiMyJ9.PdtSQiKYaeb2YZwJBhLvbA'
});
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
    baseLayer: new Cesium.ImageryLayer(mapbox),
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
}

// point collection
const physicalNodeHeight = 0;
const phyNodeMinPixelSize = 8, phyNodeMaxPixelSize = 15;
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
    constructor(_id, _type, _count, _indices) {
        super(_id, _type);
        this.count = _count;
        this.indices = _indices;
    }
}

class SubmarineCableID extends ObjectID {
    constructor(_id, _type, _featureID, _source, _date, _subID) {
        super(_id, _type);
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

main();

function main()
{
    loadPhysicalNodes();
    loadSubmarineCables();
    loadLandingPointCollection();
    loadLandCables();
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
                nodeID = new ClusterNodeID(cIndex, PRIMTYPE.CLUSTERNODE, count, indices);
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
                        id: new SubmarineCableID(cable.id, PRIMTYPE.SUBCABLE, cable.feature_id, cable.source, cable.date, index),
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
                    },
                });
                cableInstances.push(cableInstance);
            });
            landCableLineCollection.add(new Cesium.GroundPolylinePrimitive({
                geometryInstances: cableInstances,
                appearance: new Cesium.PolylineColorAppearance(),
            }));
        }
        catch (error) {
            console.error("Failed to parse coordinates: " + error);
            return;
        }
    });
}