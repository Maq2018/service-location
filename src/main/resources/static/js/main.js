// Configure Cesium
Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxM2MyODI3Zi0yZGIzLTRlOTMtYjg3My0yOGMyYTYxM2U1NjAiLCJpZCI6MjYwODAzLCJpYXQiOjE3MzM3MDgyNjh9.FY-d2_kcOZ4zQOaNZL3_Ta1CFrnb7bB3Rn8C8jsHu3E';
var mapboxStyleId = "navigation-night-v1";
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
const cameraHeight = 1e6;

// ajax parameters
const ajaxTimeout = 60 * 1000;
const baseURL = "http://101.6.8.175:22223/api/v1/servloc";
const ajaxMethod = "GET";
const ajaxDataType = "json";

// point collection
const pointCollectionIndex = 0;
const pointCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());

// link collection
const linkCollectionIndex = 1, p2cLinkIndex = 0, p2pLinkIndex = 1;
const linkCollection = scene.primitives.add(new Cesium.PrimitiveCollection());
const p2cLinkInstanceArray = [];
const p2pLinkInstanceArray = [];

// billboard collection
const billboardCollectionIndex = 2;
const billboardCollection = scene.primitives.add(new Cesium.BillboardCollection());

// physical link collection
const phyLinkCollectionIndex = 3;
const phyLinkCollection = scene.primitives.add(new Cesium.PrimitiveCollection());

// addbillboard collection (for clicked physical node's neighbors)
const addBillboardCollectionIndex = 4;
const addBillboardCollection = scene.primitives.add(new Cesium.BillboardCollection());

// add link collection (for clicked node's links)
const addLinkCollectionIndex = 5;
const addLinkCollection = scene.primitives.add(new Cesium.PrimitiveCollection());

// add point collection (for clicked node's neighbors)
const addPointCollectionIndex = 6;
const addPointCollection = scene.primitives.add(new Cesium.PointPrimitiveCollection());

// timer variable
var timer = null;
const timeoutInterval = 200; // ms

// Configuration for map
const nodeHeight = 100;
const minPixelSize = 4, maxPixelSize = 8, minDistance = 1.5e2, maxDistance = 8e6, maxScaler = 10, minScaler = 1.0;
const maxAlphaForLogicNode = 1.0, minAlphaForLogicNode = 0.7, alphaForPhyNode = 0.7;
const linkWidth = 2, linkHeight = 100;
const minAlphaForLogicLink = 0.1, maxAlphaForLogicLink = 0.5, alphaForPhyLink = 0.7;
const boardWidth = 16, boardHeight = 16, minBoardScaler = 1, maxBoardScaler = 5, phyNodeHeight = 100, phyLinkWidth = 2, phyLinkHeight = 100;
const colorMap = {"p2c": Cesium.Color.GREEN, "p2p": Cesium.Color.BLUE, "c2p": Cesium.Color.BROWN};
const phyLinkColorMap = {"Direct": Cesium.Color.PURPLE, "IXP": Cesium.Color.RED, "submarine-cable": Cesium.Color.YELLOW};
const minDrawDistance = 100; // km

// last clicked id
let lastNodeClickedId = undefined, lastPhyNodeClickedId = undefined;

// class for primitive id
class PrimitiveID {
    constructor(index, type) {
        this.index = index;
        this.type = type;
    }
}

// class for logic node id
class LogicNodeID extends PrimitiveID {
    constructor(index, type, asn, latitude, longitude, nodeType="") {
        super(index, type);
        this.asn = asn;
        this.latitude = latitude;
        this.longitude = longitude;
        this.nodeType = nodeType;
    }
}

// class for logic link id
class LogicLinkID extends PrimitiveID {
    constructor(index, type, srcNodeIndex, dstNodeIndex, linkType) {
        super(index, type);
        this.srcNodeIndex = srcNodeIndex;
        this.dstNodeIndex = dstNodeIndex;
        this.linkType = linkType;
    }
}

class PhysicalNodeID extends PrimitiveID {
    constructor(index, type, asn, country, latitude, longitude, linkType="") {
        super(index, type);
        this.asn = asn;
        this.latitude = latitude;
        this.longitude = longitude;
        this.country = country;
        this.linkType = linkType;
    }
}

class PhysicalLinkID extends PrimitiveID {
    constructor(index, type, srcNodeIndex, dstNodeIndex, linkType) {
        super(index, type);
        this.srcNodeIndex = srcNodeIndex;
        this.dstNodeIndex = dstNodeIndex;
        this.linkType = linkType;
    }
}

// main function
main();

function displayLogicNodes() {
    $.ajax({
        url: baseURL + "/logic-nodes/detail",
        type: ajaxMethod,
        dataType: ajaxDataType,
        timeout: ajaxTimeout,
    }).done(function(response) {
        const data = response.data;
        const dataLength = data.length;
        let nbOfNode = 0;
        for (let i=0; i<dataLength; i++) {
            const index = data[i].index, asn = data[i].asn, latitude = data[i].latitude, longitude = data[i].longitude;
            pointCollection.add({
                id: new LogicNodeID(index, "Node", asn, latitude, longitude),
                position: Cesium.Cartesian3.fromDegrees(longitude, latitude, nodeHeight),
                color: Cesium.Color.fromRandom({alpha: maxAlphaForLogicNode}),
                pixelSize: minPixelSize,
                scaleByDistance: new Cesium.NearFarScalar(minDistance, maxScaler, maxDistance, minScaler),
            });
            nbOfNode ++;
        }
        console.log(`NB of nodes: ${nbOfNode}`);
    });
}

function displayLogicLinks() {
    $.ajax({
        url: baseURL + "/logic-links/detail",
        type: ajaxMethod,
        dataType: ajaxDataType,
        timeout: ajaxTimeout,
    }).done(function(response) {
        const data = response.data;
        let nbOfLink = 0;
        for (let i=0; i<data.length; i++) {
            // add source node
            const srcNodeIndex = data[i].src_node_index, srcLatitude = data[i].src_latitude, srcLongitude = data[i].src_longitude;
            // add destination node
            const dstNodeIndex = data[i].dst_node_index, dstLatitude = data[i].dst_latitude, dstLongitude = data[i].dst_longitude;;
            // add link
            const linkIndex = data[i].index;
            const linkType = data[i].link_type;
            const polylineInstance = new Cesium.GeometryInstance({
                id: new LogicLinkID(linkIndex, "Link", srcNodeIndex, dstNodeIndex, linkType),
                geometry: new Cesium.PolylineGeometry({
                    positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                        srcLongitude, srcLatitude, linkHeight,
                        dstLongitude, dstLatitude, linkHeight,
                    ]),
                    width: linkWidth,
                    vertexFormat : Cesium.PolylineColorAppearance.VERTEX_FORMAT
                }),
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(colorMap[linkType].withAlpha(minAlphaForLogicLink)),
                },
            });
            if (linkType === "p2c") {
                p2cLinkInstanceArray.push(polylineInstance);
            }
            else {
                p2pLinkInstanceArray.push(polylineInstance);
            }
            nbOfLink ++;
        }
        linkCollection.add(
            new Cesium.Primitive({
                geometryInstances: p2cLinkInstanceArray,
                appearance: new Cesium.PolylineColorAppearance({
                    translucent : true
                }),
            })
        );
        linkCollection.add(
            new Cesium.Primitive({
                geometryInstances: p2pLinkInstanceArray,
                appearance: new Cesium.PolylineColorAppearance({
                    translucent : true
                }),
            })
        );
        console.log(`NB of links: ${nbOfLink}`);
        console.log(`NB of p2c links: ${p2cLinkInstanceArray.length}`);
        console.log(`NB of p2p links: ${p2pLinkInstanceArray.length}`);
    });
}

function displayStatistiscs() {
    displayASRank();
}

function displayASRank() {
    $.ajax({
        url: baseURL + "/asrank/detail",
        type: ajaxMethod,
        dataType: ajaxDataType,
        timeout: ajaxTimeout,
    }).done(function(response) {
        const data = response.data;
        let logicAsnSummary = document.getElementById("logic-links-asn-summary-body");
        for (let i = 0; i < data.length; i++) {
            let trElement = document.createElement("tr");
            // append index
            let tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(`${i+1}`));
            trElement.appendChild(tdElement);
            // append asn
            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(`${data[i].asn}`));
            trElement.appendChild(tdElement);
            // append name
            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(`${data[i].name}`));
            trElement.appendChild(tdElement);
            // append organization
            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(`${data[i].organization}`));
            trElement.appendChild(tdElement);
            // append country flag
            tdElement = document.createElement("td");
            let img = document.createElement("img");
            img.src = `/flags/${data[i].country_code}.png`;
            tdElement.appendChild(img);
            trElement.appendChild(tdElement);
            // append country
            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(`${data[i].country}`));
            trElement.appendChild(tdElement);
            // append provider
            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(`${data[i].degree_provider}`));
            tdElement.style.borderLeft = "1px solid white";
            trElement.appendChild(tdElement);
            // append peer
            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(`${data[i].degree_peer}`));
            trElement.appendChild(tdElement);
            // append customer
            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(`${data[i].degree_customer}`));
            trElement.appendChild(tdElement);
            // apppend number of prefixes
            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(`${data[i].prefix_size}`));
            trElement.appendChild(tdElement);
            // append cone size
            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(`${data[i].cone_size}`));
            trElement.appendChild(tdElement);
            // append cone prefix size
            tdElement = document.createElement("td");
            tdElement.appendChild(document.createTextNode(`${data[i].cone_prefix_size}`));
            trElement.appendChild(tdElement);
            // apppend row
            logicAsnSummary.appendChild(trElement);
        }
    });
}

function selectLogicLinks() {
    $("#select-logic-links").change(function() {
        let opt = $("#select-logic-links").val();
        switch (opt) {
            case "P2C":
                scene.primitives.get(linkCollectionIndex).get(p2pLinkIndex).show = false;
                scene.primitives.get(linkCollectionIndex).get(p2cLinkIndex).show = true;
                break;
            case "P2P":
                scene.primitives.get(linkCollectionIndex).get(p2cLinkIndex).show = false;
                scene.primitives.get(linkCollectionIndex).get(p2pLinkIndex).show = true;
                break;
            case "ALL":
                scene.primitives.get(linkCollectionIndex).get(p2cLinkIndex).show = true;
                scene.primitives.get(linkCollectionIndex).get(p2pLinkIndex).show = true;
                break;
        }
    });
}

function fillLogicLinkInfoBox(nodeIndex) {
    console.log("Fill logic link info box for node index: " + nodeIndex);
    $.ajax({
        url: baseURL + "/logic-nodes/detail",
        type: ajaxMethod,
        data: {"idxs": `${nodeIndex}`},
        dataType: ajaxDataType,
        timeout: ajaxTimeout,
    }).done(function(response) {
        const data = response.data;
        const dataLength = data.length;
        let nodeDetailElem = document.getElementById("logic-links-infobox-body");
        while (nodeDetailElem.firstChild) {
            nodeDetailElem.removeChild(nodeDetailElem.firstChild);
        }
        $(".logic-links-infobox-member-expand").text("Expand");
        $("tr").remove(".logic-links-infobox-member-expand-tr");
        if (dataLength < 1) return;
        const nodeInfo = data[0];
        let trElement = document.createElement("tr");
        // append index
        let thElement = document.createElement("th");
        thElement.appendChild(document.createTextNode("ASN"));
        trElement.appendChild(thElement);
        let tdElement = document.createElement("td");
        tdElement.appendChild(document.createTextNode(nodeInfo.asn));
        trElement.appendChild(tdElement);
        nodeDetailElem.appendChild(trElement);
        // append name
        trElement = document.createElement("tr");
        thElement = document.createElement("th");
        thElement.appendChild(document.createTextNode("Name"));
        trElement.appendChild(thElement);
        tdElement = document.createElement("td");
        tdElement.appendChild(document.createTextNode(nodeInfo.name));
        trElement.appendChild(tdElement);
        nodeDetailElem.appendChild(trElement);
        // append organization
        trElement = document.createElement("tr");
        thElement = document.createElement("th");
        thElement.appendChild(document.createTextNode("Organization"));
        trElement.appendChild(thElement);
        tdElement = document.createElement("td");
        tdElement.appendChild(document.createTextNode(nodeInfo.organization));
        trElement.appendChild(tdElement);
        nodeDetailElem.appendChild(trElement);
        // append country
        trElement = document.createElement("tr");
        thElement = document.createElement("th");
        thElement.appendChild(document.createTextNode("Region"));
        trElement.appendChild(thElement);
        tdElement = document.createElement("td");
        tdElement.appendChild(document.createTextNode(nodeInfo.country));
        trElement.appendChild(tdElement);
        nodeDetailElem.appendChild(trElement);
        // append latitude
        trElement = document.createElement("tr");
        thElement = document.createElement("th");
        thElement.appendChild(document.createTextNode("Latitude"));
        trElement.appendChild(thElement);
        tdElement = document.createElement("td");
        tdElement.appendChild(document.createTextNode(nodeInfo.latitude));
        trElement.appendChild(tdElement);
        nodeDetailElem.appendChild(trElement);
        // append longitude
        trElement = document.createElement("tr");
        thElement = document.createElement("th");
        thElement.appendChild(document.createTextNode("Longitude"));
        trElement.appendChild(thElement);
        tdElement = document.createElement("td");
        tdElement.appendChild(document.createTextNode(nodeInfo.longitude));
        trElement.appendChild(tdElement);
        nodeDetailElem.appendChild(trElement);
        // set visible
        document.getElementById("logic-links-infobox").style.visibility = "visible";
    });
}


function drawSpecificASLogicMap(data, nodeIndex)
{
    pointCollection.show = false;
    linkCollection.show = false;
    const addlinkInstanceArray = [];
    addLinkCollection.removeAll();
    addPointCollection.removeAll();
    let addPointDrawFlag = {};
    for (let i = 0; i < data.length; i++) {
        const addLinkIndex = data[i].index;
        const srcNodeIndex = data[i].src_node_index, dstNodeIndex = data[i].dst_node_index, srcAsn = data[i].src_asn, dstAsn = data[i].dst_asn;
        const srcLatitude = data[i].src_latitude, srcLongitude = data[i].src_longitude, dstLatitude = data[i].dst_latitude, dstLongitude = data[i].dst_longitude;
        let linkType = undefined;
        
        if (data[i].link_type === "p2c" && nodeIndex === dstNodeIndex) { linkType = "c2p"; }
        else { linkType = data[i].link_type; }

        if (addPointDrawFlag[srcNodeIndex] === undefined) {
            let nodeColor = (srcNodeIndex === nodeIndex) ? Cesium.Color.BLACK : Cesium.Color.fromRandom({alpha: minAlphaForLogicNode});
            let pixelSize = (srcNodeIndex === nodeIndex) ? maxPixelSize : minPixelSize;
            let nodeType = undefined;
            if (srcNodeIndex === nodeIndex) { nodeType = "Base"; }
            else {
                nodeType = (data[i].link_type === "p2c") ? "Provider" : ((data[i].link_type === "p2p")? "Peer" : "");
            }
            addPointCollection.add({
                id: new LogicNodeID(srcNodeIndex, "Node", srcAsn, srcLatitude, srcLongitude, nodeType),
                position: Cesium.Cartesian3.fromDegrees(srcLongitude, srcLatitude, nodeHeight),
                color: nodeColor,
                pixelSize: pixelSize,
                scaleByDistance: new Cesium.NearFarScalar(minDistance, maxScaler, maxDistance, minScaler),
            });
            addPointDrawFlag[srcNodeIndex] = true;
        }

        if (addPointDrawFlag[dstNodeIndex] === undefined) {
            let nodeColor = (dstNodeIndex === nodeIndex) ? Cesium.Color.BLACK : Cesium.Color.fromRandom({alpha: minAlphaForLogicNode});
            let pixelSize = (dstNodeIndex === nodeIndex) ? maxPixelSize : minPixelSize;
            let nodeType = undefined;
            if (dstNodeIndex === nodeIndex) { nodeType = "Base"; }
            else {
                nodeType = (data[i].link_type === "p2c") ? "Customer" : ((data[i].link_type === "p2p")? "Peer" : "");
            }
            addPointCollection.add({
                id: new LogicNodeID(dstNodeIndex, "Node", dstAsn, dstLatitude, dstLongitude, nodeType),
                position: Cesium.Cartesian3.fromDegrees(dstLongitude, dstLatitude, nodeHeight),
                color: nodeColor,
                pixelSize: pixelSize,
                scaleByDistance: new Cesium.NearFarScalar(minDistance, maxScaler, maxDistance, minScaler),
            });
            addPointDrawFlag[dstNodeIndex] = true;
        }

        addlinkInstanceArray.push(new Cesium.GeometryInstance({
            id: new LogicLinkID(addLinkIndex, "Link", srcNodeIndex, dstNodeIndex, linkType),
            geometry: new Cesium.PolylineGeometry({
                positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                    srcLongitude, srcLatitude, linkHeight,
                    dstLongitude, dstLatitude, linkHeight,
                ]),
                width: linkWidth,
                vertexFormat : Cesium.PolylineColorAppearance.VERTEX_FORMAT
            }),
            attributes: {
                color: Cesium.ColorGeometryInstanceAttribute.fromColor(colorMap[linkType].withAlpha(maxAlphaForLogicLink)),
            },
        }));
    }
    addLinkCollection.add(
        new Cesium.Primitive({
            geometryInstances: addlinkInstanceArray,
            appearance: new Cesium.PolylineColorAppearance({
                translucent : true
            }),
        })
    );
    addPointCollection.show = true;
    addLinkCollection.show = true;
}


function queryForSpecificLogicNodeIndex(nodeIndex) {
    $.ajax({
        url: baseURL + "/logic-links/detail",
        type: ajaxMethod,
        data: {"idxs": `${nodeIndex}`},
        dataType: ajaxDataType,
        timeout: ajaxTimeout,
    }).done(function(response) {
        const data = response.data;
        const dataLength = data.length;
        if (dataLength < 1) return;
        drawSpecificASLogicMap(data, nodeIndex);
    });
}


function fillServLocInfoBox(nodeInfo) {
    console.log("Fill servloc info box for node index: " + nodeInfo.index);
    const asn = nodeInfo.asn, country = nodeInfo.country, latitude = nodeInfo.latitude, longitude = nodeInfo.longitude;
    let servlocInfoboxBody = document.getElementById("servloc-infobox-body");
    while (servlocInfoboxBody.firstChild) {
        servlocInfoboxBody.removeChild(servlocInfoboxBody.firstChild);
    }
    $(".servloc-infobox-member-expand").text("Expand");
    $("tr").remove(".servloc-infobox-member-expand-tr");
    // append asn
    let trElement = document.createElement("tr");
    let thElement = document.createElement("th");
    thElement.appendChild(document.createTextNode("ASN"));
    trElement.appendChild(thElement);
    let tdElement = document.createElement("td");
    tdElement.appendChild(document.createTextNode(asn));
    trElement.appendChild(tdElement);
    servlocInfoboxBody.append(trElement);
    // append country
    trElement = document.createElement("tr");
    thElement = document.createElement("th");
    thElement.appendChild(document.createTextNode("Region"));
    trElement.appendChild(thElement);
    tdElement = document.createElement("td");
    tdElement.appendChild(document.createTextNode(country));
    trElement.appendChild(tdElement);
    servlocInfoboxBody.append(trElement);
    // append latitude
    trElement = document.createElement("tr");
    thElement = document.createElement("th");
    thElement.appendChild(document.createTextNode("Latitude"));
    trElement.appendChild(thElement);
    tdElement = document.createElement("td");
    tdElement.appendChild(document.createTextNode(latitude));
    trElement.appendChild(tdElement);
    servlocInfoboxBody.append(trElement);
    // append longitude
    trElement = document.createElement("tr");
    thElement = document.createElement("th");
    thElement.appendChild(document.createTextNode("Longitude"));
    trElement.appendChild(thElement);
    tdElement = document.createElement("td");
    tdElement.appendChild(document.createTextNode(longitude));
    trElement.appendChild(tdElement);
    servlocInfoboxBody.append(trElement);
    // set visible
    document.getElementById("servloc-infobox").style.visibility = "visible";
}


function queryForSpecificPhysicalNodeIndex(phyNodeIndex) {
    addBillboardCollection.removeAll();
    phyLinkCollection.removeAll();

    $.ajax({
        url: baseURL + "/phy-links/detail",
        type: ajaxMethod,
        data: {"nidxs": `${phyNodeIndex}`},
        dataType: ajaxDataType,
        timeout: ajaxTimeout,
    }).done(function(response) {
        const data = response.data;
        const dataLength = data.length;
        if (dataLength < 1) return;
        const phyLinkInstanceArray = [];
        for (let i = 0; i < data.length; i++) {
            const linkIndex = data[i].index;
            const srcNodeIndex = data[i].src_nidx, dstNodeIndex = data[i].dst_nidx;
            const nodeIndex = (srcNodeIndex === phyNodeIndex) ? dstNodeIndex : srcNodeIndex;
            const latitude = (srcNodeIndex === phyNodeIndex) ? data[i].dst_latitude : data[i].src_latitude;
            const longitude = (srcNodeIndex === phyNodeIndex) ? data[i].dst_longitude : data[i].src_longitude;
            const asn = (srcNodeIndex === phyNodeIndex) ? data[i].dst_asn : data[i].src_asn;
            const country = (srcNodeIndex === phyNodeIndex) ? data[i].dst_country : data[i].src_country;
            const linkType = data[i].link_type;
            const linkDistance = data[i].distance;
            if ((linkDistance !== undefined) && (linkDistance < minDistance)) continue;
            
            addBillboardCollection.add({
                id: new PhysicalNodeID(nodeIndex, "PhyNode", asn, country, latitude, longitude, linkType),
                position: Cesium.Cartesian3.fromDegrees(longitude, latitude, phyNodeHeight),
                image: "/svg/router.svg",
                width: boardWidth,
                height: boardHeight,
                scaleByDistance: new Cesium.NearFarScalar(minDistance, maxBoardScaler, maxDistance, minBoardScaler),
                color: phyLinkColorMap[linkType].withAlpha(alphaForPhyNode),
            });

            const srcLatitude = data[i].src_latitude, srcLongitude = data[i].src_longitude, dstLatitude = data[i].dst_latitude, dstLongitude = data[i].dst_longitude;
            phyLinkInstanceArray.push(new Cesium.GeometryInstance({
                id: new PhysicalLinkID(linkIndex, "PhyLink", srcNodeIndex, dstNodeIndex, linkType),
                geometry: new Cesium.PolylineGeometry({
                    positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                        srcLongitude, srcLatitude, phyLinkHeight,
                        dstLongitude, dstLatitude, phyLinkHeight,
                    ]),
                    width: phyLinkWidth,
                    vertexFormat : Cesium.PolylineColorAppearance.VERTEX_FORMAT
                }),
                attributes: {
                    color: Cesium.ColorGeometryInstanceAttribute.fromColor(phyLinkColorMap[linkType].withAlpha(alphaForPhyLink)),
                },
            }));
        }
        phyLinkCollection.add(
            new Cesium.Primitive({
                geometryInstances: phyLinkInstanceArray,
                appearance: new Cesium.PolylineColorAppearance({
                    translucent : true
                }),
            })
        );
    });
}


function quertForSpecificPhysicalNodeAsn(asn) {
    pointCollection.show = false;
    linkCollection.show = false;
    addPointCollection.removeAll();
    addPointCollection.show = false;
    addLinkCollection.removeAll();
    addLinkCollection.show = false;
    billboardCollection.removeAll();

    $.ajax({
        url: baseURL + "/nodes/detail",
        type: 'GET',
        data: {"asns": `${asn}`},
        dataType: 'json',
        timeout: ajaxTimeout,
    }).done(function(response) {
        const data = response.data;
        const dataLength = data.length;
        if (dataLength < 1) return;
        for (let i=0; i<data.length; i++) {
            const index = data[i].index, asn = data[i].asn, country = data[i].country, latitude = data[i].latitude, longitude = data[i].longitude;
            billboardCollection.add({
                id: new PhysicalNodeID(index, "PhyNode", asn, country, latitude, longitude),
                position: Cesium.Cartesian3.fromDegrees(longitude, latitude, phyNodeHeight),
                image: "/svg/router.svg",
                width: boardWidth,
                height: boardHeight,
                scaleByDistance: new Cesium.NearFarScalar(minDistance, maxBoardScaler, maxDistance, minBoardScaler),
            });
        }
    });
}


function logicLinksInfoboxExpandAndCollapse() {
    $(".logic-links-infobox-member-expand").click(function() {
        console.log("Expand clicked, lastNodeClickedId: " + lastNodeClickedId);
        if (lastNodeClickedId !== undefined) {
            if ($(this).text() === "Expand") {
                $.ajax({
                    url: baseURL + "/logic-links/detail",
                    type: ajaxMethod,
                    data: {"idxs": `${lastNodeClickedId}`},
                    dataType: ajaxDataType,
                    timeout: ajaxTimeout,
                }).done(function(response) {
                    const data = response.data;
                    const dataLength = data.length;
                    if (dataLength < 1) return;
                    let relationshipMap = {};
                    for (let i = 0; i < dataLength; i++) {
                        const srcNodeIndex = data[i].src_node_index, dstNodeIndex = data[i].dst_node_index;
                        const linkType = data[i].link_type;
                        if (linkType === "p2c") {
                            if (srcNodeIndex === lastNodeClickedId) relationshipMap[dstNodeIndex] = "Customer";
                            else if (dstNodeIndex === lastNodeClickedId) relationshipMap[srcNodeIndex] = "Provider";
                        }
                        else if (linkType === "p2p") {
                            if (srcNodeIndex === lastNodeClickedId) relationshipMap[dstNodeIndex] = "Peer";
                            else if (dstNodeIndex === lastNodeClickedId) relationshipMap[srcNodeIndex] = "Peer";
                        }
                    }

                    // query for information of clicked node neighbor
                    // Todo: debug for parameters containing non-integer
                    let keyList = Object.keys(relationshipMap);
                    let filteredKeyList = [];
                    let queryParam = ""
                    for (let j=0; j<keyList.length; j++) {
                        let pm = parseInt(keyList[j]);
                        if (!isNaN(pm)) {
                            filteredKeyList.push(keyList[j]);
                        }
                    }
                    queryParam = filteredKeyList.join(",");

                    $.ajax({
                        url: baseURL + "/logic-nodes/detail",
                        type: ajaxMethod,
                        data: {"idxs": queryParam},
                        dataType: ajaxDataType,
                        timeout: ajaxTimeout,
                    }).done(function(response) {
                        const data = response.data;
                        const dataLength = data.length;
                        if (dataLength < 1) return;
                        for (let i = 0; i < dataLength; i++) {
                            let trElement = document.createElement("tr");
                            trElement.className = "logic-links-infobox-member-expand-tr";
                            // append index
                            let tdElement = document.createElement("td");
                            tdElement.style.width = "10%";
                            tdElement.appendChild(document.createTextNode(`${dataLength - i}`));
                            trElement.appendChild(tdElement);
                            // append asn
                            tdElement = document.createElement("td");
                            tdElement.style.width = "20%";
                            tdElement.appendChild(document.createTextNode(data[i].asn));
                            trElement.appendChild(tdElement);
                            // append name
                            tdElement = document.createElement("td");
                            tdElement.style.width = "30%";
                            tdElement.appendChild(document.createTextNode(data[i].name));
                            trElement.appendChild(tdElement);
                            // append country
                            tdElement = document.createElement("td");
                            tdElement.style.width = "10%";
                            tdElement.appendChild(document.createTextNode(data[i].country_code));
                            trElement.appendChild(tdElement);
                            // append relationship
                            tdElement = document.createElement("td");
                            tdElement.style.width = "30%";
                            tdElement.appendChild(document.createTextNode(relationshipMap[data[i].index]));
                            trElement.appendChild(tdElement);
                            $("#logic-links-infobox-member-body").prepend(trElement);
                        }
                        $(".logic-links-infobox-member-expand").text("Collapse");
                    });
                });
            }
            else {
                $("tr").remove(".logic-links-infobox-member-expand-tr");
                $(this).text("Expand");
            }
        }
    });
}


function servlocInfoboxExpandAndCollapse() {
    $(".servloc-infobox-member-expand").click(function() {
        console.log("Expand clicked, lastPhyNodeClickedId: " + lastPhyNodeClickedId);
        if (lastPhyNodeClickedId !== undefined) {
            if ($(this).text() === "Expand") {
                $.ajax({
                    url: baseURL + "/phy-links/detail",
                    type: ajaxMethod,
                    data: {"nidxs": `${lastPhyNodeClickedId}`},
                    dataType: ajaxDataType,
                    timeout: ajaxTimeout,
                }).done(function(response) {
                    const data = response.data;
                    const length = data.length;
                    if (length < 1) return;
                    for (let i=0; i<length; i++) {
                        const linkDistance = data[i].distance;
                        if ((linkDistance !== undefined) && (linkDistance < minDrawDistance)) continue;
                        const srcNodeIndex = data[i].src_nidx, dstNodeIndex = data[i].dst_nidx;
                        const asn = (srcNodeIndex === lastPhyNodeClickedId) ? data[i].dst_asn : data[i].src_asn;
                        const country = (srcNodeIndex === lastPhyNodeClickedId) ? data[i].dst_country : data[i].src_country;
                        const phyLinkType = data[i].link_type;
                        // append asn
                        let trElement = document.createElement("tr");
                        let tdElement = document.createElement("td");
                        tdElement.appendChild(document.createTextNode(asn));
                        trElement.appendChild(tdElement);
                        // append country
                        tdElement = document.createElement("td");
                        tdElement.appendChild(document.createTextNode(country));
                        trElement.appendChild(tdElement);
                        // append type
                        tdElement = document.createElement("td");
                        tdElement.appendChild(document.createTextNode(phyLinkType));
                        trElement.appendChild(tdElement);
                        trElement.className = "servloc-infobox-member-expand-tr";
                        $("#servloc-infobox-member-body").prepend(trElement);
                    }
                    $(".servloc-infobox-member-expand").text("Collapse");
                });
            }
            else {
                $("tr").remove(".servloc-infobox-member-expand-tr");
                $(this).text("Expand");
            }
        }
    });
}


function searchForSpecificAsn(asn) {
    console.log("Query for ASN: " + asn);
    $.ajax({
        url: baseURL + "/logic-links/detail",
        type: ajaxMethod,
        data: {"asns": `${asn}`},
        dataType: ajaxDataType,
        timeout: ajaxTimeout,
    }).done(function(response) {
        const data = response.data;
        let nodeIndex = undefined, flyToLatitude = undefined, flyToLongitude = undefined;
        for (let i = 0; i < data.length; i++) {
            if (data[i].src_asn === asn) {
                nodeIndex = data[i].src_node_index;
                flyToLatitude = data[i].src_latitude;
                flyToLongitude = data[i].src_longitude;
                break;
            }
            else if (data[i].dst_asn === asn) {
                nodeIndex = data[i].dst_node_index;
                flyToLatitude = data[i].dst_latitude;
                flyToLongitude = data[i].dst_longitude;
                break;
            }
        }
        if (nodeIndex === undefined) {
            alert("ASN not found!");
            return;
        }
        lastNodeClickedId = nodeIndex;
        
        drawSpecificASLogicMap(data, nodeIndex);

        viewer.camera.flyTo({
            destination: Cesium.Cartesian3.fromDegrees(flyToLongitude, flyToLatitude, cameraHeight),
        });
        fillLogicLinkInfoBox(nodeIndex);
    });
}


function main()
{
    displayLogicNodes();
    displayLogicLinks();
    selectLogicLinks();

    // left click event, display the clicked node information
    const handler = new Cesium.ScreenSpaceEventHandler(scene.canvas);
    handler.setInputAction((movement) => {
        clearTimeout(timer);
        let timeoutID = setTimeout(window.setTimeout(function() {
            const pick = scene.pick(movement.position);
            if (Cesium.defined(pick) && Cesium.defined(pick.id)) {
                const selectObj = pick.id;
                if (selectObj.type === "Node") {
                    const nodeIndex = selectObj.index;
                    lastNodeClickedId = nodeIndex;
                    fillLogicLinkInfoBox(nodeIndex);
                    queryForSpecificLogicNodeIndex(nodeIndex);
                }
                else if (selectObj.type === "PhyNode") {
                    const phyNodeIndex = selectObj.index;
                    lastPhyNodeClickedId = phyNodeIndex;
                    fillServLocInfoBox(selectObj);
                    queryForSpecificPhysicalNodeIndex(phyNodeIndex);
                }
            }
            else {
                document.getElementById("logic-links-infobox").style.visibility = "hidden";
                document.getElementById("servloc-infobox").style.visibility = "hidden";
            }
        }), timeoutInterval);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    // left double click event, clear the logic view, display the physical view
    handler.setInputAction((movement) => {
        clearTimeout(timer);
        const pick = scene.pick(movement.position);
        if (Cesium.defined(pick) && Cesium.defined(pick.id) && (pick.id.type === "Node")) {
            const asn = pick.id.asn;
            quertForSpecificPhysicalNodeAsn(asn);
        }
    }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

    // right click event, clear the physical view, display the logic view
    handler.setInputAction((movement) => {
        document.getElementById("logic-links-infobox").style.visibility = "hidden";
        document.getElementById("servloc-infobox").style.visibility = "hidden";
        billboardCollection.removeAll();
        phyLinkCollection.removeAll();
        addBillboardCollection.removeAll();
        addLinkCollection.removeAll();
        addPointCollection.removeAll();
        pointCollection.show = true;
        linkCollection.show = true;
    }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);

    // mouse over addPhyNode event, display the tipbox
    handler.setInputAction((movement) => {
        let selectObj = scene.pick(movement.endPosition);
        if (Cesium.defined(selectObj) && Cesium.defined(selectObj.id)) {
            let tipBox = document.getElementById("tipbox");
            if (selectObj.id.type === "PhyNode") {
                tipBox.style.visibility = "visible";
                tipBox.style.left = movement.endPosition.x + 10 + "px";
                tipBox.style.top = movement.endPosition.y + 10 + "px";
                tipBox.innerHTML = `ASN: ${selectObj.id.asn}<br>Country: ${selectObj.id.country}<br>Link Type: ${selectObj.id.linkType}`;
            }
            else if (selectObj.id.type === "PhyLink") {
                tipBox.style.visibility = "visible";
                tipBox.style.left = movement.endPosition.x + 10 + "px";
                tipBox.style.top = movement.endPosition.y + 10 + "px";
                tipBox.innerHTML = `Type: ${selectObj.id.linkType}`;
            }
            else if (selectObj.id.type === "Node") {
                tipBox.style.visibility = "visible";
                tipBox.style.left = movement.endPosition.x + 10 + "px";
                tipBox.style.top = movement.endPosition.y + 10 + "px";
                tipBox.innerHTML = `ASN: ${selectObj.id.asn}<br>Type: ${selectObj.id.nodeType}`;
            }
            else if (selectObj.id.type === "Link") {
                tipBox.style.visibility = "visible";
                tipBox.style.left = movement.endPosition.x + 10 + "px";
                tipBox.style.top = movement.endPosition.y + 10 + "px";
                tipBox.innerHTML = `Type: ${selectObj.id.linkType}`;
            }
        }
        else {
            document.getElementById("tipbox").style.visibility = "hidden";
        }
    }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

    // expand button, display neighbors of the clicked node
    logicLinksInfoboxExpandAndCollapse();

    // expand button, display neighbors of the clicked phynode
    servlocInfoboxExpandAndCollapse();

    // binding enter keyborad event for search-input
    $("#search-input").on("keyup", function(e) {
        if (e.key === 'Enter' || e.keyCode === 13) {
            let queryString = $("#search-input").val();
            if (queryString.startsWith("AS") && !isNaN(parseInt(queryString.substring(2)))) {
                const asn = parseInt(queryString.substring(2));
                searchForSpecificAsn(asn);
            }
        }
    });

    // binding search button event
    $("#search-button").click(function() {
        let queryString = $("#search-input").val();
        if (queryString.startsWith("AS") && !isNaN(parseInt(queryString.substring(2)))) {
            const asn = parseInt(queryString.substring(2));
            searchForSpecificAsn(asn);
        }
    });

    // display stats
    displayStatistiscs();
}