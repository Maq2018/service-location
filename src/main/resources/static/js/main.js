function calc_coordinates(pos_array) {
    let lati = 0, lngi = 0;
    if (pos_array.length === 0) {
        return {lng: 0, lat:0};
    }
    for (let i = 0; i < pos_array.length; i++) {
        lati += pos_array[i].lat;
        lngi += pos_array[i].lng;
    }
    return {lng: lngi / pos_array.length, lat: lati / pos_array.length};
}


function roundFloat(num) {
    return Math.round(num * 10000) / 10000;
}


Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiIxM2MyODI3Zi0yZGIzLTRlOTMtYjg3My0yOGMyYTYxM2U1NjAiLCJpZCI6MjYwODAzLCJpYXQiOjE3MzM3MDgyNjh9.FY-d2_kcOZ4zQOaNZL3_Ta1CFrnb7bB3Rn8C8jsHu3E';
const viewer = new Cesium.Viewer('cesiumContainer', {
    timeline:false,
    animation: false,
    skyBox: false,
    fullscreenButton: false,
    terrainProvider: new Cesium.EllipsoidTerrainProvider(),
});
var ajaxTimeout = 60 * 1000; // in milliseconds
var loadServLocStats = false;
var servlocAppliedBindings = false;

$(".selectMode li").click(function() {
    if (!$(this).hasClass("onSelect")) {
        viewer.dataSources.removeAll();
        let selectTabId = $(".onSelect").attr("id");
        switch (selectTabId) {
            case "tab-servloc":
                $("#servloc-display").css("visibility", "hidden");
                $(".onSelect").removeClass("onSelect");
                break;
            case "tab-logic-links":
                $(".onSelect").removeClass("onSelect");
                break;
            case "tab-cable":
                $(".onSelect").removeClass("onSelect");
                break;
        }
        $(this).addClass("onSelect");
        switch ($(this).attr("id")) {
            case "tab-servloc":
                $("#servloc-display").css("visibility", "visible");
                tabServLoc();
                break;
            case "tab-logic-links":
                tabLogicalLinks();
                break;
            case "tab-cable":
                tabCable();
                break;
        }
    }
});

tabLogicalLinks();

function tabServLoc() {
    const nodeSource = new Cesium.CustomDataSource('Nodes');
    const linkSource = new Cesium.CustomDataSource('Links');
    var lid2SrcCid = {};
    var lid2DstCid = [];
    // setting up infobox close event
    $("#servloc-infobox-close").click(function() {
        document.getElementById("servloc-infobox").style.visibility = "hidden";
        let linkSource = viewer.dataSources.getByName("Links")[0];
        let entityCollectionValues = linkSource.entities.values;
        for (let i=0; i<entityCollectionValues.length; i++) {
            let entity = entityCollectionValues[i];
            entity.show = false;
        }
    });

    $.ajax({
        url: 'http://101.6.8.175:22223/api/v1/servloc/clusters/detail',
        type: 'GET',
        dataType: 'json',
        timeout: ajaxTimeout,
    }).done(function(response) {
        let data = response.data;
        nodeSource.entities.suspendEvents();
        for (let i = 0; i < data.length; i++) {
            const clusterId = data[i].index, latitude = data[i].latitude, longitude = data[i].longitude, size = data[i].size;
            let entity = nodeSource.entities.add({
                id: `Cluster-${clusterId}`,
                name: `Cluster-${clusterId}`,
                position: Cesium.Cartesian3.fromDegrees(longitude, latitude),
                billboard: {
                    image: "/svg/router.svg",
                    width: 24,
                    height: 24,
                },
                label: {
                    text: `Cluster-${clusterId}`,
                    font: '14px sans-serif',
                    style: Cesium.LabelStyle.FILL_AND_OUTLINE,
                    outlineWidth: 2,
                    verticalOrigin: Cesium.VerticalOrigin.TOP,
                    pixelOffset: new Cesium.Cartesian2(0, 14),
                },
            });
        }
        nodeSource.entities.resumeEvents();

        const dataSourcePremise = viewer.dataSources.add(nodeSource);
        dataSourcePremise.then(function(dataSource) {
            const pixelRange = 28;
            const minimumClusterSize = 3;
            const enabled = true;

            dataSource.clustering.enabled = enabled;
            dataSource.clustering.pixelRange = pixelRange;
            dataSource.clustering.minimumClusterSize = minimumClusterSize;

            let removeListener;

            const pinBuilder = new Cesium.PinBuilder();
            const pin100 = pinBuilder.fromText("100+", Cesium.Color.RED, 52).toDataURL();
            const pin50 = pinBuilder.fromText("50+", Cesium.Color.PURPLE, 48).toDataURL();
            const pin40 = pinBuilder.fromText("40+", Cesium.Color.ORANGE, 44).toDataURL();
            const pin30 = pinBuilder.fromText("30+", Cesium.Color.YELLOW, 40).toDataURL();
            const pin20 = pinBuilder.fromText("20+", Cesium.Color.GREEN, 36).toDataURL();
            const pin10 = pinBuilder.fromText("10+", Cesium.Color.BLUE, 32).toDataURL();

            const singleDigitPins = new Array(8);
            for (let i = 0; i < singleDigitPins.length; ++i) {
                singleDigitPins[i] = pinBuilder
                .fromText(`${i + 2}`, Cesium.Color.VIOLET, 28)
                .toDataURL();
            }

            function customStyle() {
                if (Cesium.defined(removeListener)) {
                    removeListener();
                    removeListener = undefined;
                } 
                else {
                    removeListener = dataSource.clustering.clusterEvent.addEventListener(
                        function (clusteredEntities, cluster) {
                            cluster.label.show = false;
                            cluster.billboard.show = true;
                            cluster.billboard.id = cluster.label.id;
                            cluster.billboard.verticalOrigin = Cesium.VerticalOrigin.BOTTOM;

                            if (clusteredEntities.length >= 100) {
                                cluster.billboard.image = pin100;
                            }
                            else if (clusteredEntities.length >= 50) {
                                cluster.billboard.image = pin50;
                            }
                            else if (clusteredEntities.length >= 40) {
                                cluster.billboard.image = pin40;
                            }
                            else if (clusteredEntities.length >= 30) {
                                cluster.billboard.image = pin30;
                            }
                            else if (clusteredEntities.length >= 20) {
                                cluster.billboard.image = pin20;
                            }
                            else if (clusteredEntities.length >= 10) {
                                cluster.billboard.image = pin10;
                            }
                            else {
                                cluster.billboard.image = singleDigitPins[clusteredEntities.length - 2];
                            }
                        },
                    );
                }

                // force a re-cluster with the new styling
                const pixelRange = dataSource.clustering.pixelRange;
                dataSource.clustering.pixelRange = 0;
                dataSource.clustering.pixelRange = pixelRange;
            }

            // start with custom style
            customStyle();
            // if (!servlocAppliedBindings) {
            //     const viewModel = {
            //         pixelRange: pixelRange,
            //         minimumClusterSize: minimumClusterSize,
            //     };
            //     Cesium.knockout.track(viewModel);
    
            //     const toolbar = document.getElementById("toolbar");
            //     Cesium.knockout.applyBindings(viewModel, toolbar);
    
            //     function subscribeParameter(name) {
            //             Cesium.knockout.getObservable(viewModel, name).subscribe(function (newValue) {
            //             dataSource.clustering[name] = newValue;
            //         });
            //     }
            //     subscribeParameter("pixelRange");
            //     subscribeParameter("minimumClusterSize");
            //     servlocAppliedBindings = true;
            // }
        });
    });

    $.ajax({
        url: "http://101.6.8.175:22223/api/v1/servloc/phy-links/detail",
        type: 'GET',
        dataType: 'json',
        timeout: ajaxTimeout,
    }).done(function(response) {
        const data = response.data;
        const colorMap = {"Direct": Cesium.Color.GREEN, "IXP": Cesium.Color.RED, "submarine-cable": Cesium.Color.BLUE};
        const lineWidth = 2, lineHeight = 100000;
        linkSource.entities.suspendEvents();
        console.log(`NB of links: ${data.length}`);
        let nb_added_links = 0;
        for (let i = 0; i < data.length; i++) {
            if (!data[i].cross_cluster) continue;
            if (data[i].distance > 6000 || data[i].distance < 100) continue;
            let index = data[i].index;
            let src_lat = data[i].src_latitude, src_lng = data[i].src_longitude, dst_lat = data[i].dst_latitude, dst_lng = data[i].dst_longitude;
            src_lat = roundFloat(src_lat); src_lng = roundFloat(src_lng); dst_lat = roundFloat(dst_lat); dst_lng = roundFloat(dst_lng);
            const link_type = data[i].link_type;
            let linkColor = colorMap[link_type];
            let entity = linkSource.entities.add({
                id: `Link-${index}`,
                name: `Link-${index}`,
                polyline: {
                    positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                        src_lng, src_lat, lineHeight,
                        dst_lng, dst_lat, lineHeight,
                    ]),
                    width: lineWidth,
                    material: linkColor,
                },
            });
            lid2SrcCid[index] = data[i].src_cidx;
            lid2DstCid[index] = data[i].dst_cidx;
            let description = "<table class='cesium-infoBox-defaultTable'><tbody>" + "<tr><th>Link</th><td>" + index + "</td></tr>";
            description += "<tr><th>ASN 1</th><td>" + data[i].src_asn + "</td></tr>";
            description += "<tr><th>Region 1</th><td>" + data[i].src_country + "</td></tr>";
            description += "<tr><th>Position</th><td>" + `${src_lat},${dst_lat}` + "</td></tr>";
            description += "<tr><th>ASN2</th><td>" + data[i].dst_asn + "</td></tr>";
            description += "<tr><th>Region 2</th><td>" + data[i].dst_country + "</td></tr>";
            description += "<tr><th>Position</th><td>" + `${dst_lat},${dst_lng}` + "</td></tr>";
            description += "<tr><th>Type</th><td>" + link_type + "</td></tr>";
            description += "</tbody></table>";
            entity.description = description;
            entity.show = false;
            nb_added_links++;
        }
        console.log(`NB of added links: ${nb_added_links}`);
        linkSource.entities.resumeEvents();
        viewer.dataSources.add(linkSource);
    });

    viewer.selectedEntityChanged.addEventListener(function(selectedEntity) {
        if (Cesium.defined(selectedEntity)) {
            if (Cesium.defined(selectedEntity.name) && selectedEntity.name.startsWith("Cluster")) {
                hide = false;
                let clusterId = selectedEntity.id;
                clusterId = parseInt(clusterId.replace("Cluster-", ""));
                $.ajax({
                    url: "http://101.6.8.175:22223/api/v1/servloc/nodes/detail",
                    type: 'GET',
                    data: {"cidxs": clusterId},
                    dataType: 'json',
                    timeout: ajaxTimeout,
                }).done(function(response) {
                    let data = response.data;
                    let nodeDetailElem = document.getElementById("servloc-infobox-body");
                    while (nodeDetailElem.firstChild) {
                        nodeDetailElem.removeChild(nodeDetailElem.firstChild);
                    }
                    for (let i = 0; i < data.length; i++) {
                        let tr_elem = document.createElement("tr");
                        // append asn
                        let td_elem = document.createElement("td");
                        td_elem.appendChild(document.createTextNode(data[i].asn));
                        tr_elem.appendChild(td_elem);
                        //append image
                        td_elem = document.createElement("td");
                        let img = document.createElement("img");
                        img.src = `/flags/${data[i].country}.png`;
                        td_elem.appendChild(img);
                        tr_elem.appendChild(td_elem);
                        // append country
                        td_elem = document.createElement("td");
                        td_elem.appendChild(document.createTextNode(data[i].country));
                        tr_elem.appendChild(td_elem);
                        // append latitude
                        td_elem = document.createElement("td");
                        td_elem.appendChild(document.createTextNode(data[i].latitude));
                        tr_elem.appendChild(td_elem);
                        // append longitude
                        td_elem = document.createElement("td");
                        td_elem.appendChild(document.createTextNode(data[i].longitude));
                        tr_elem.appendChild(td_elem);
                        // append row
                        nodeDetailElem.appendChild(tr_elem);
                    }
                    document.getElementById("servloc-infobox").style.visibility = "visible";
                });
                let linkSourceCollection = viewer.dataSources.getByName("Links");
                let selectLinkSource = linkSourceCollection[0];
                if (selectLinkSource !== undefined) {
                    let entityCollectionValues = selectLinkSource.entities.values;
                    for (let i=0; i<entityCollectionValues.length; i++) {
                        let entity = entityCollectionValues[i];
                        let entityId = entity.id;
                        const index = parseInt(entityId.replace("Link-", ""));
                        const src_cid = lid2SrcCid[index];
                        const dst_cid = lid2DstCid[index];
                        if (src_cid == clusterId || dst_cid == clusterId) {
                            entity.show = true;
                        }
                    }
                }
            }
        }
        else {
            document.getElementById("servloc-infobox").style.visibility = "hidden";
            let linkSource = viewer.dataSources.getByName("Links")[0];
            if (linkSource !== undefined) {
                let entityCollectionValues = linkSource.entities.values;
                for (let i=0; i<entityCollectionValues.length; i++) {
                    let entity = entityCollectionValues[i];
                    entity.show = false;
                }
            }
        }
    });

    if (loadServLocStats) {
        $("#servloc-display").css("visibility", "visible");
    }
    else {
        $.ajax({
            url: "http://101.6.8.175:22223/api/v1/servloc/nodes/summary/country",
            type: 'GET',
            dataType: 'json',
            timeout: ajaxTimeout,
        }).done(function(response) {
            let data = response.data;
            let countrySummaryElem = document.getElementById("country-summary-body");
            for (let i = 0; i < data.length; i++) {
                let tr_elem = document.createElement("tr");
                let td_elem = document.createElement("td");
                // append index
                td_elem.appendChild(document.createTextNode(`${i+1}`));
                tr_elem.appendChild(td_elem);
                // append country flag
                td_elem = document.createElement("td");
                let img = document.createElement("img");
                img.src = `/flags/${data[i]._id}.png`;
                td_elem.appendChild(img);
                tr_elem.appendChild(td_elem);
                // append country code
                td_elem = document.createElement("td");
                td_elem.appendChild(document.createTextNode(data[i]._id));
                tr_elem.appendChild(td_elem);
                //append count
                td_elem = document.createElement("td");
                td_elem.appendChild(document.createTextNode(data[i].count));
                tr_elem.appendChild(td_elem);
                // append row
                countrySummaryElem.appendChild(tr_elem);
            }
        });

        $.ajax({
            url: "http://101.6.8.175:22223/api/v1/servloc/nodes/summary/asn",
            type: 'GET',
            dataType: 'json',
            timeout: ajaxTimeout,
        }).done(function(response) {
            let data = response.data;
            let asns = data[0]._id;
            for (let i=0; i<data.length; i++) {
                asns += "," + data[i]._id;
            }
            $.ajax({
                url: "http://101.6.8.175:22223/api/v1/servloc/asrank/detail",
                type: 'GET',
                data: {"asns": asns},
                dataType: 'json',
                timeout: ajaxTimeout,
            }).done(function(response) {
                let asrank = response.data;
                let asrankMap = new Map();
                for (let i = 0; i < asrank.length; i++) {
                    asrankMap.set(asrank[i].asn, asrank[i]);
                }
                let asnSummaryElem = document.getElementById("asn-summary-body");
                for (let i = 0; i < data.length; i++) {
                    let asn_info = asrankMap.get(data[i]._id);
                    let tr_elem = document.createElement("tr");
                    let td_elem = document.createElement("td");
                    // append index
                    td_elem.appendChild(document.createTextNode(`${i+1}`));
                    tr_elem.appendChild(td_elem);
                    // append asn
                    td_elem = document.createElement("td");
                    td_elem.appendChild(document.createTextNode(data[i]._id));
                    tr_elem.appendChild(td_elem);
                    //append name
                    td_elem = document.createElement("td");
                    td_elem.appendChild(document.createTextNode(asn_info.name));
                    tr_elem.appendChild(td_elem);
                    // append organization
                    td_elem = document.createElement("td");
                    td_elem.appendChild(document.createTextNode(asn_info.organization));
                    tr_elem.appendChild(td_elem);
                    // append flag
                    td_elem = document.createElement("td");
                    let img = document.createElement("img");
                    img.src = `/flags/${asn_info.country}.png`;
                    td_elem.appendChild(img);
                    tr_elem.appendChild(td_elem);
                    // append country
                    td_elem = document.createElement("td");
                    td_elem.appendChild(document.createTextNode(asn_info.country));
                    tr_elem.appendChild(td_elem);
                    // append nb_servloc
                    td_elem = document.createElement("td");
                    td_elem.appendChild(document.createTextNode(data[i].count));
                    tr_elem.appendChild(td_elem);
                    // append row
                    asnSummaryElem.appendChild(tr_elem);
                }
            });
        });
        loadServLocStats = true;
    }   
}

function tabLogicalLinks()
{
    idx2src_asn = {};
    idx2dst_asn = {};

    $.ajax({
        url: "http://101.6.8.175:22223/api/v1/servloc/logic-links/detail",
        type: 'GET',
        dataType: 'json',
        timeout: ajaxTimeout,
    }).done(function(response) {
        const node_height = 100;
        const data = response.data;
        const logicNodeSource = new Cesium.CustomDataSource('LogicNodes');
        const logicLinkSource = new Cesium.CustomDataSource('LogicLinks');
        let nodeMap = {};
        const line_height = 100;
        let colorMap = {"p2c": Cesium.Color.RED, "p2p": Cesium.Color.GREEN};
        logicNodeSource.entities.suspendEvents();
        logicLinkSource.entities.suspendEvents();
        let nb_node = 0, nb_link = 0;
        for (let i = 0; i < data.length; i++) {
            let index = data[i].index;
            let src_asn = data[i].src_asn, src_country = data[i].src_country, src_lat = data[i].src_latitude, src_lng = data[i].src_longitude;
            if (nodeMap[src_asn] === undefined) {
                let entity = logicNodeSource.entities.add({
                    id: `ASN-${src_asn}`,
                    name: `ASN-${src_asn}`,
                    position: Cesium.Cartesian3.fromDegrees(src_lng, src_lat, node_height),
                    point: {
                        pixelSize: 5,
                        Color: Cesium.Color.fromRandom({alpha: 1}),
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                    }
                });
                let description = "<table class='cesium-infoBox-defaultTable'><tbody>" + "<tr><th>ASN</th><td>" + src_asn + "</td></tr>";
                description += "<tr><th>Region</th><td>" + src_country + "</td></tr>";
                description += "<tr><th>Position</th><td>" + `${src_lat},${src_lng}` + "</td></tr>";
                description += "</tbody></table>";
                entity.description = description;
                nodeMap[src_asn] = 1;
                nb_node ++;
            }
            let dst_asn = data[i].dst_asn, dst_country = data[i].dst_country, dst_lat = data[i].dst_latitude, dst_lng = data[i].dst_longitude;
            if (nodeMap[dst_asn] === undefined) {
                let entity = logicNodeSource.entities.add({
                    id: `ASN-${dst_asn}`,
                    name: `ASN-${dst_asn}`,
                    position: Cesium.Cartesian3.fromDegrees(dst_lng, dst_lat, node_height),
                    point: {
                        pixelSize: 5,
                        Color: Cesium.Color.fromRandom({alpha: 0.7}),
                        outlineColor: Cesium.Color.BLACK,
                        outlineWidth: 2,
                    }
                });
                let description = "<table class='cesium-infoBox-defaultTable'><tbody>" + "<tr><th>ASN</th><td>" + dst_asn + "</td></tr>";
                description += "<tr><th>Region</th><td>" + dst_country + "</td></tr>";
                description += "<tr><th>Position</th><td>" + `${dst_lat},${dst_lng}` + "</td></tr>";
                description += "</tbody></table>";
                entity.description = description;
                nodeMap[dst_asn] = 1;
                nb_node ++;
            }
            let link_type = data[i].link_type;
            let entity = logicLinkSource.entities.add({
                id: `link-${index}`,
                name: `link-${index}`,
                polyline: {
                    positions: Cesium.Cartesian3.fromDegreesArrayHeights([
                        src_lng, src_lat, line_height,
                        dst_lng, dst_lat, line_height,
                    ]),
                    width: 1,
                    material: colorMap[link_type],
                },
            });
            idx2src_asn[index] = src_asn;
            idx2dst_asn[index] = dst_asn;
            let description = "<table class='cesium-infoBox-defaultTable'><tbody>" + "<tr><th>Link</th><td>" + index + "</td></tr>";
            description += "<tr><th>ASN 1</th><td>" + data[i].src_asn + "</td></tr>";
            description += "<tr><th>Region 1</th><td>" + data[i].src_country + "</td></tr>";
            description += "<tr><th>Position</th><td>" + `${src_lat},${dst_lat}` + "</td></tr>";
            description += "<tr><th>ASN2</th><td>" + data[i].dst_asn + "</td></tr>";
            description += "<tr><th>Region 2</th><td>" + data[i].dst_country + "</td></tr>";
            description += "<tr><th>Position</th><td>" + `${dst_lat},${dst_lng}` + "</td></tr>";
            description += "<tr><th>Type</th><td>" + link_type + "</td></tr>";
            description += "</tbody></table>";
            entity.description = description;
            entity.show = false;
            nb_link ++;
        }
        logicNodeSource.entities.resumeEvents();
        logicLinkSource.entities.resumeEvents();
        viewer.dataSources.add(logicLinkSource);
        viewer.dataSources.add(logicNodeSource);
        console.log(`NB of nodes: ${nb_node}`);
        console.log(`NB of links: ${nb_link}`);
    });

    viewer.selectedEntityChanged.addEventListener(function(selectedEntity) {
        if (Cesium.defined(selectedEntity)) {
            if (Cesium.defined(selectedEntity.name) && selectedEntity.name.startsWith("ASN")) {
                let selectedEntityId = selectedEntity.id;
                selectedEntityId = parseInt(selectedEntityId.replace("ASN-", ""));
                const logicLinkSource = viewer.dataSources.getByName("LogicLinks")[0];
                if (logicLinkSource !== undefined) {
                    const entityCollectionValues = logicLinkSource.entities.values;
                    for (let i=0; i<entityCollectionValues.length; i++) {
                        const entity = entityCollectionValues[i];
                        let entityId = entity.id;
                        entityId = parseInt(entityId.replace("link-", ""));
                        const src_asn = idx2src_asn[entityId];
                        const dst_asn = idx2dst_asn[entityId];
                        if (src_asn == selectedEntityId || dst_asn == selectedEntityId) {
                            entity.show = true;
                        }
                        else {
                            entity.show = false;
                        }
                    }
                }
            }
        }
        else {
            const logicLinkSource = viewer.dataSources.getByName("LogicLinks")[0];
            if (logicLinkSource !== undefined) {
                const entityCollectionValues = logicLinkSource.entities.values;
                for (let i=0; i<entityCollectionValues.length; i++) {
                    const entity = entityCollectionValues[i];
                    entity.show = false;
                }
            }
        }
    });
}

function tabCable()
{
    // Todo
}
