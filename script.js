/* =========================================================
   MEDUSA — SAFE ROUTE PLANNER
   Complete JavaScript
   Map + Routes + Facilities + Live GPS + CCTV
   ========================================================= */


/* =========================================================
   GLOBAL VARIABLES
   ========================================================= */

let map = null;

let routeLayer = null;
let startMarker = null;
let endMarker = null;

let facilityLayer = null;

let facilityStore = {
    police: [],
    hospital: [],
    toilets: [],
    pharmacy: []
};

let facilityMarkers = {
    police: {},
    hospital: {},
    toilets: {},
    pharmacy: {}
};


/* =========================================================
   LIVE GPS VARIABLES
   ========================================================= */

let gpsWatchId = null;
let gpsMarker = null;
let gpsAccuracyCircle = null;


/* =========================================================
   CCTV VARIABLES
   ========================================================= */

let cctvLayer = null;
let cctvVisible = false;


/* =========================================================
   OVERPASS SERVERS
   ========================================================= */

const OVERPASS_SERVERS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.private.coffee/api/interpreter"
];


/* =========================================================
   GMDA GOVERNMENT CCTV API
   ========================================================= */

const GMDA_CCTV_URL =
    "https://onemapdepts.gmda.gov.in/server/rest/services/Homeland_Security/MapServer/16/query";


/* =========================================================
   PAGE INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    initializeMap();

    addLiveGpsControl();

    addCCTVControl();

});


/* =========================================================
   MAP INITIALIZATION
   ========================================================= */

function initializeMap() {

    const mapElement = document.getElementById("map");

    if (!mapElement) {
        console.error("Medusa: #map element not found.");
        return;
    }

    map = L.map("map").setView(
        [28.6139, 77.2090],
        12
    );


    L.tileLayer(
        "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
        {
            maxZoom: 19,
            attribution:
                "&copy; OpenStreetMap contributors"
        }
    ).addTo(map);


    facilityLayer = L.layerGroup().addTo(map);

    cctvLayer = L.layerGroup().addTo(map);


    facilityMarkers = {
        police: {},
        hospital: {},
        toilets: {},
        pharmacy: {}
    };


    /*
       Fix Leaflet map size after page layout loads.
    */

    setTimeout(function () {

        if (map) {
            map.invalidateSize();
        }

    }, 300);

}


/* =========================================================
   SCROLL TO PLANNER
   ========================================================= */

function scrollToPlanner() {

    const planner =
        document.getElementById("planner");

    if (!planner) return;

    planner.scrollIntoView({
        behavior: "smooth"
    });

}


/* =========================================================
   GEOCODING
   ========================================================= */

async function getCoordinates(place) {

    const url =
        "https://nominatim.openstreetmap.org/search" +
        "?format=jsonv2" +
        "&limit=1" +
        "&countrycodes=in" +
        "&q=" +
        encodeURIComponent(
            place + ", Delhi, India"
        );


    const response = await fetch(url, {
        headers: {
            "Accept": "application/json"
        }
    });


    if (!response.ok) {
        throw new Error(
            "Location search failed."
        );
    }


    const data = await response.json();


    if (!data || data.length === 0) {
        throw new Error(
            "Location not found: " + place
        );
    }


    return {
        lat: Number(data[0].lat),
        lon: Number(data[0].lon),
        displayName:
            data[0].display_name || place
    };

}


/* =========================================================
   DISTANCE
   ========================================================= */

function distanceKm(
    lat1,
    lon1,
    lat2,
    lon2
) {

    const R = 6371;

    const dLat =
        (lat2 - lat1) *
        Math.PI /
        180;

    const dLon =
        (lon2 - lon1) *
        Math.PI /
        180;


    const a =
        Math.sin(dLat / 2) *
        Math.sin(dLat / 2) +

        Math.cos(
            lat1 * Math.PI / 180
        ) *

        Math.cos(
            lat2 * Math.PI / 180
        ) *

        Math.sin(dLon / 2) *
        Math.sin(dLon / 2);


    const c =
        2 *
        Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );


    return R * c;

}


/* =========================================================
   HTML ESCAPE
   ========================================================= */

function escapeHTML(value) {

    if (
        value === null ||
        value === undefined
    ) {
        return "";
    }


    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");

}


/* =========================================================
   FACILITY HELPERS
   ========================================================= */

function facilityEmoji(type) {

    if (type === "police") {
        return "🚔";
    }

    if (type === "hospital") {
        return "🏥";
    }

    if (type === "toilets") {
        return "🚻";
    }

    if (type === "pharmacy") {
        return "💊";
    }

    return "📍";

}


function facilityTitle(type) {

    if (type === "police") {
        return "Police Stations";
    }

    if (type === "hospital") {
        return "Hospitals & Clinics";
    }

    if (type === "toilets") {
        return "Public Toilets";
    }

    if (type === "pharmacy") {
        return "Pharmacies";
    }

    return "Facilities";

}


/* =========================================================
   FACILITY ADDRESS
   ========================================================= */

function getAddress(tags) {

    if (!tags) {
        return "Address not available";
    }


    const parts = [];


    if (tags["addr:housenumber"]) {
        parts.push(
            tags["addr:housenumber"]
        );
    }


    if (tags["addr:street"]) {
        parts.push(
            tags["addr:street"]
        );
    }


    if (tags["addr:suburb"]) {
        parts.push(
            tags["addr:suburb"]
        );
    }


    if (tags["addr:city"]) {
        parts.push(
            tags["addr:city"]
        );
    }


    if (tags["addr:postcode"]) {
        parts.push(
            tags["addr:postcode"]
        );
    }


    if (parts.length === 0) {
        return "Address not available in OpenStreetMap";
    }


    return parts.join(", ");

}


/* =========================================================
   FACILITY ICON
   ========================================================= */

function createFacilityIcon(type) {

    return L.divIcon({

        className: "",

        html:
            '<div style="' +

            'background:#17111f;' +

            'border:2px solid #a96cff;' +

            'border-radius:50%;' +

            'width:34px;' +

            'height:34px;' +

            'display:flex;' +

            'align-items:center;' +

            'justify-content:center;' +

            'font-size:18px;' +

            'box-shadow:0 2px 8px rgba(0,0,0,.5);' +

            '">' +

            facilityEmoji(type) +

            "</div>",

        iconSize: [
            34,
            34
        ],

        iconAnchor: [
            17,
            17
        ]

    });

}


/* =========================================================
   ROUTE SAMPLE POINTS
   ========================================================= */

function getRouteSamplePoints(coords) {

    const points = [];

    const count = 10;

    if (!coords || coords.length === 0) {
        return points;
    }


    const step =
        Math.max(
            1,
            Math.floor(
                coords.length / count
            )
        );


    for (
        let i = 0;
        i < coords.length;
        i += step
    ) {

        points.push(
            coords[i]
        );

    }


    const last =
        coords[coords.length - 1];


    if (
        points.length === 0 ||
        points[points.length - 1] !== last
    ) {

        points.push(last);

    }


    return points;

}


/* =========================================================
   GET FACILITIES ALONG ROUTE
   ========================================================= */

async function getFacilitiesAlongRoute(
    coords
) {

    const points =
        getRouteSamplePoints(coords);


    const queries = [];


    points.forEach(function (point) {

        const lat = point[0];
        const lon = point[1];


        queries.push(
            'nwr["amenity"="police"]' +
            '(around:2500,' +
            lat +
            "," +
            lon +
            ");"
        );


        queries.push(
            'nwr["amenity"="hospital"]' +
            '(around:2500,' +
            lat +
            "," +
            lon +
            ");"
        );


        queries.push(
            'nwr["amenity"="clinic"]' +
            '(around:2500,' +
            lat +
            "," +
            lon +
            ");"
        );


        queries.push(
            'nwr["healthcare"="hospital"]' +
            '(around:2500,' +
            lat +
            "," +
            lon +
            ");"
        );


        queries.push(
            'nwr["healthcare"="clinic"]' +
            '(around:2500,' +
            lat +
            "," +
            lon +
            ");"
        );


        queries.push(
            'nwr["amenity"="toilets"]' +
            '(around:2500,' +
            lat +
            "," +
            lon +
            ");"
        );


        queries.push(
            'nwr["amenity"="pharmacy"]' +
            '(around:2500,' +
            lat +
            "," +
            lon +
            ");"
        );


        queries.push(
            'nwr["healthcare"="pharmacy"]' +
            '(around:2500,' +
            lat +
            "," +
            lon +
            ");"
        );

    });


    const query =
        "[out:json][timeout:60];(" +
        queries.join("") +
        ");out center;";


    let lastError = null;


    for (
        const server of OVERPASS_SERVERS
    ) {

        try {

            const response =
                await fetch(
                    server,
                    {
                        method: "POST",
                        headers: {
                            "Content-Type":
                                "text/plain"
                        },
                        body: query
                    }
                );


            if (!response.ok) {

                throw new Error(
                    "Overpass server returned " +
                    response.status
                );

            }


            const data =
                await response.json();


            return data.elements || [];

        }

        catch (error) {

            console.warn(
                "Overpass server failed:",
                server,
                error
            );

            lastError = error;

        }

    }


    throw (
        lastError ||
        new Error(
            "Facility service unavailable."
        )
    );

}


/* =========================================================
   PREPARE FACILITY DATA
   ========================================================= */

function prepareFacilityData(elements) {

    facilityStore = {
        police: [],
        hospital: [],
        toilets: [],
        pharmacy: []
    };


    facilityMarkers = {
        police: {},
        hospital: {},
        toilets: {},
        pharmacy: {}
    };


    const seen = new Set();


    elements.forEach(function (element) {

        const tags =
            element.tags || {};


        let lat =
            element.lat;

        let lon =
            element.lon;


        if (
            (
                lat === undefined ||
                lon === undefined
            ) &&
            element.center
        ) {

            lat =
                element.center.lat;

            lon =
                element.center.lon;

        }


        if (
            lat === undefined ||
            lon === undefined
        ) {

            return;

        }


        lat = Number(lat);
        lon = Number(lon);


        if (
            !Number.isFinite(lat) ||
            !Number.isFinite(lon)
        ) {

            return;

        }


        let type = null;


        if (
            tags.amenity === "police"
        ) {

            type = "police";

        }

        else if (
            tags.amenity === "hospital" ||
            tags.amenity === "clinic" ||
            tags.healthcare === "hospital" ||
            tags.healthcare === "clinic"
        ) {

            type = "hospital";

        }

        else if (
            tags.amenity === "toilets"
        ) {

            type = "toilets";

        }

        else if (
            tags.amenity === "pharmacy" ||
            tags.healthcare === "pharmacy"
        ) {

            type = "pharmacy";

        }


        if (!type) {
            return;
        }


        const key =
            type +
            "_" +
            lat.toFixed(5) +
            "_" +
            lon.toFixed(5);


        if (seen.has(key)) {
            return;
        }


        seen.add(key);


        let name =
            tags.name;


        if (!name) {

            if (type === "police") {
                name = "Police Station";
            }

            else if (type === "hospital") {
                name = "Hospital / Clinic";
            }

            else if (type === "toilets") {
                name = "Public Toilet";
            }

            else if (type === "pharmacy") {
                name = "Pharmacy";
            }

        }


        facilityStore[type].push({

            id:
                type +
                "_" +
                element.type +
                "_" +
                element.id,

            name: name,

            address:
                getAddress(tags),

            lat: lat,

            lon: lon,

            phone:
                tags.phone ||
                tags["contact:phone"] ||
                "",

            hours:
                tags.opening_hours ||
                ""

        });

    });

}


/* =========================================================
   DISPLAY FACILITY MARKERS
   ========================================================= */

function displayFacilityMarkers() {

    if (!facilityLayer) {
        return;
    }


    facilityLayer.clearLayers();


    Object.keys(
        facilityStore
    ).forEach(function (type) {


        facilityStore[type]
            .forEach(function (facility) {


                let popup =

                    "<b>" +
                    escapeHTML(
                        facility.name
                    ) +
                    "</b><br><br>" +

                    facilityEmoji(type) +
                    " " +
                    facilityTitle(type) +

                    "<br><br>📍 " +

                    escapeHTML(
                        facility.address
                    );


                if (facility.phone) {

                    popup +=
                        "<br>📞 " +
                        escapeHTML(
                            facility.phone
                        );

                }


                if (facility.hours) {

                    popup +=
                        "<br>🕐 " +
                        escapeHTML(
                            facility.hours
                        );

                }


                const marker =
                    L.marker(
                        [
                            facility.lat,
                            facility.lon
                        ],
                        {
                            icon:
                                createFacilityIcon(
                                    type
                                )
                        }
                    )
                    .addTo(facilityLayer)
                    .bindPopup(popup);


                facilityMarkers[type][
                    facility.id
                ] = marker;

            });

    });

}


/* =========================================================
   FACILITY LIST
   ========================================================= */

function showFacilityList(type) {

    const list =
        document.getElementById(
            "facility-list"
        );


    if (!list) {
        return;
    }


    const facilities =
        facilityStore[type] || [];


    let html =

        "<h3>" +

        facilityEmoji(type) +

        " " +

        facilityTitle(type) +

        " (" +

        facilities.length +

        ")</h3>";


    if (
        facilities.length === 0
    ) {

        html +=
            '<div class="no-facilities">' +

            "No mapped facilities found near this route." +

            "<br><br>" +

            "This does not necessarily mean the facility does not exist." +

            "</div>";


        list.innerHTML = html;

        list.classList.add(
            "active"
        );

        return;

    }


    facilities.forEach(
        function (facility, index) {

            html +=

                '<div class="facility-card" ' +

                'onclick="focusFacility(\'' +

                escapeHTML(type) +

                "','" +

                escapeHTML(
                    facility.id
                ) +

                '\')">' +


                '<div class="facility-name">' +

                (index + 1) +

                ". " +

                escapeHTML(
                    facility.name
                ) +

                "</div>" +


                '<div class="facility-detail">' +

                "📍 " +

                escapeHTML(
                    facility.address
                ) +

                "</div>";


            if (facility.phone) {

                html +=

                    '<div class="facility-detail">' +

                    "📞 " +

                    escapeHTML(
                        facility.phone
                    ) +

                    "</div>";

            }


            if (facility.hours) {

                html +=

                    '<div class="facility-detail">' +

                    "🕐 " +

                    escapeHTML(
                        facility.hours
                    ) +

                    "</div>";

            }


            html +=
                "</div>";

        }
    );


    list.innerHTML = html;

    list.classList.add(
        "active"
    );

}


/* =========================================================
   FOCUS FACILITY
   ========================================================= */

function focusFacility(
    type,
    id
) {

    const facility =
        (
            facilityStore[type] || []
        ).find(function (item) {

            return item.id === id;

        });


    if (!facility || !map) {
        return;
    }


    map.setView(
        [
            facility.lat,
            facility.lon
        ],
        17
    );


    const marker =
        facilityMarkers[type] &&
        facilityMarkers[type][id];


    if (marker) {
        marker.openPopup();
    }

}


/* =========================================================
   FIND ROUTES
   ========================================================= */

async function findRoutes() {

    const fromInput =
        document.getElementById("from");

    const toInput =
        document.getElementById("to");

    const timeInput =
        document.getElementById("time");

    const results =
        document.getElementById("results");


    if (
        !fromInput ||
        !toInput ||
        !results
    ) {

        console.error(
            "Planner elements missing."
        );

        return;

    }


    const from =
        fromInput.value.trim();

    const to =
        toInput.value.trim();

    const time =
        timeInput
            ? timeInput.value
            : "day";


    if (!from || !to) {

        results.innerHTML =

            '<div class="route-result">' +

            "<h3>⚠ Please enter both locations.</h3>" +

            "</div>";

        return;

    }


    results.innerHTML =

        '<div class="route-result">' +

        "<h3>🔎 Finding route...</h3>" +

        '<p style="color:#aaa;">' +

        "Calculating road route and checking nearby facilities..." +

        "</p>" +

        "</div>";


    try {

        const start =
            await getCoordinates(from);

        const end =
            await getCoordinates(to);


        /*
           OSRM real driving route
        */

        const routeURL =

            "https://router.project-osrm.org/route/v1/driving/" +

            start.lon +
            "," +
            start.lat +

            ";" +

            end.lon +
            "," +
            end.lat +

            "?overview=full" +

            "&geometries=geojson" +

            "&alternatives=true";


        const routeResponse =
            await fetch(routeURL);


        if (!routeResponse.ok) {

            throw new Error(
                "Routing service unavailable."
            );

        }


        const routeData =
            await routeResponse.json();


        if (
            !routeData.routes ||
            routeData.routes.length === 0
        ) {

            throw new Error(
                "No road route found."
            );

        }


        const route =
            routeData.routes[0];


        /*
           Remove previous route
        */

        if (routeLayer) {

            map.removeLayer(
                routeLayer
            );

            routeLayer = null;

        }


        if (startMarker) {

            map.removeLayer(
                startMarker
            );

            startMarker = null;

        }


        if (endMarker) {

            map.removeLayer(
                endMarker
            );

            endMarker = null;

        }


        if (facilityLayer) {

            facilityLayer.clearLayers();

        }


        const coordinates =

            route.geometry.coordinates
                .map(function (point) {

                    return [
                        point[1],
                        point[0]
                    ];

                });


        /*
           Draw route
        */

        routeLayer =
            L.polyline(
                coordinates,
                {
                    color: "#a96cff",
                    weight: 6,
                    opacity: 0.9
                }
            ).addTo(map);


        /*
           Start marker
        */

        startMarker =
            L.marker(
                [
                    start.lat,
                    start.lon
                ]
            )
            .addTo(map)
            .bindPopup(

                "<b>Starting Point</b><br>" +

                escapeHTML(
                    start.displayName
                )

            );


        /*
           Destination marker
        */

        endMarker =
            L.marker(
                [
                    end.lat,
                    end.lon
                ]
            )
            .addTo(map)
            .bindPopup(

                "<b>Destination</b><br>" +

                escapeHTML(
                    end.displayName
                )

            );


        /*
           Fit map
        */

        map.fitBounds(
            routeLayer.getBounds(),
            {
                padding: [
                    40,
                    40
                ]
            }
        );


        /*
           Load facilities
        */

        let facilityError =
            false;


        try {

            const elements =
                await getFacilitiesAlongRoute(
                    coordinates
                );


            prepareFacilityData(
                elements
            );


            displayFacilityMarkers();

        }

        catch (error) {

            console.error(
                "Facility loading error:",
                error
            );

            facilityError =
                true;

        }


        /*
           Facility counts
        */

        const police =
            facilityStore.police.length;

        const hospitals =
            facilityStore.hospital.length;

        const toilets =
            facilityStore.toilets.length;

        const pharmacies =
            facilityStore.pharmacy.length;


        const total =
            police +
            hospitals +
            toilets +
            pharmacies;


        /*
           Route information
        */

        const distance =
            (
                route.distance / 1000
            ).toFixed(1);


        const minutes =
            Math.round(
                route.duration / 60
            );


        const timeText =
            time === "night"
                ? "🌙 Night"
                : "☀️ Day";


        /*
           Result message
        */

        let facilityMessage = "";


        if (facilityError) {

            facilityMessage =

                '<div class="warning">' +

                "⚠ Facility data could not be loaded right now. " +

                "You can try the route again." +

                "</div>";

        }

        else {

            facilityMessage =

                '<div class="warning">' +

                "Click Police, Hospital, Toilet or Pharmacy " +

                "to see names and details." +

                "</div>";

        }


        results.innerHTML =

            '<div class="route-result">' +


            "<h3>🟢 Route 1 — Recommended</h3>" +


            '<div class="route-info">' +

            "<span>📍 " +
            distance +
            " km</span>" +

            "<span>⏱ " +
            minutes +
            " min</span>" +

            "<span>" +
            timeText +
            "</span>" +

            "</div>" +


            '<div class="score safe">' +

            "Route calculated successfully" +

            "</div>" +


            '<div style="' +

            "margin-top:15px;" +

            "padding:15px;" +

            "background:#17111f;" +

            "border-radius:10px;" +

            "color:#ddd;" +

            "line-height:2;" +

            '">' +


            "🛡️ <b>" +
            total +
            "</b> nearby facilities" +

            "<br>" +

            "🚔 Police: <b>" +
            police +
            "</b>" +

            "&nbsp;&nbsp;" +

            "🏥 Hospitals: <b>" +
            hospitals +
            "</b>" +

            "<br>" +

            "🚻 Toilets: <b>" +
            toilets +
            "</b>" +

            "&nbsp;&nbsp;" +

            "💊 Pharmacies: <b>" +
            pharmacies +
            "</b>" +

            "</div>" +


            facilityMessage +


            '<div class="warning">' +

            "⚠ Facility information is based on " +

            "OpenStreetMap data and may be incomplete or outdated." +

            "</div>" +


            "</div>";

    }


    catch (error) {

        console.error(
            "Route error:",
            error
        );


        results.innerHTML =

            '<div class="route-result">' +

            "<h3>⚠ Route could not be calculated</h3>" +

            '<p style="color:#aaa;">' +

            escapeHTML(
                error.message
            ) +

            "</p>" +

            "</div>";

    }

}


/* =========================================================
   LIVE GPS CONTROL
   ========================================================= */

function addLiveGpsControl() {

    if (!map) {
        return;
    }


    const control =
        L.control({
            position: "topright"
        });


    control.onAdd =
        function () {

            const div =
                L.DomUtil.create(
                    "div",
                    "leaflet-bar"
                );


            div.style.background =
                "#17111f";

            div.style.borderRadius =
                "10px";

            div.style.overflow =
                "hidden";

            div.style.boxShadow =
                "0 3px 12px rgba(0,0,0,.35)";


            /*
               Only this GPS control moves down.
               It does NOT move the whole Leaflet control area.
            */

            div.style.transform =
                "translateY(75px)";


            div.innerHTML =

                '<button id="gps-toggle" ' +

                'type="button" ' +

                'style="' +

                'border:0;' +

                'background:#17111f;' +

                'color:#fff;' +

                'padding:10px 13px;' +

                'font-weight:600;' +

                'cursor:pointer;' +

                'font-size:13px;' +

                '">' +

                "Start Live GPS" +

                "</button>";


            L.DomEvent.disableClickPropagation(
                div
            );


            return div;

        };


    control.addTo(map);


    const button =
        document.getElementById(
            "gps-toggle"
        );


    if (button) {

        button.addEventListener(
            "click",
            function () {

                if (
                    gpsWatchId === null
                ) {

                    startLiveGPS();

                }

                else {

                    stopLiveGPS();

                }

            }
        );

    }

}


/* =========================================================
   START LIVE GPS
   ========================================================= */

function startLiveGPS() {

    if (!navigator.geolocation) {

        alert(
            "Live GPS is not supported by this browser."
        );

        return;

    }


    const button =
        document.getElementById(
            "gps-toggle"
        );


    if (button) {

        button.textContent =
            "Starting GPS...";

    }


    gpsWatchId =
        navigator.geolocation.watchPosition(

            function (position) {

                const lat =
                    position.coords.latitude;

                const lon =
                    position.coords.longitude;

                const accuracy =
                    position.coords.accuracy;


                updateGPSMarker(
                    lat,
                    lon,
                    accuracy
                );


                if (button) {

                    button.textContent =
                        "Stop Live GPS";

                }

            },


            function (error) {

                console.error(
                    "GPS error:",
                    error
                );


                if (button) {

                    button.textContent =
                        "Start Live GPS";

                }


                gpsWatchId = null;


                let message =
                    "Unable to get your location.";


                if (
                    error.code ===
                    error.PERMISSION_DENIED
                ) {

                    message =
                        "Location permission was denied. Please allow location access in your browser.";

                }

                else if (
                    error.code ===
                    error.POSITION_UNAVAILABLE
                ) {

                    message =
                        "Your current location is unavailable.";

                }

                else if (
                    error.code ===
                    error.TIMEOUT
                ) {

                    message =
                        "Location request timed out. Please try again.";

                }


                alert(message);

            },


            {
                enableHighAccuracy: true,

                maximumAge: 5000,

                timeout: 15000

            }

        );

}


/* =========================================================
   UPDATE GPS MARKER
   ========================================================= */

function updateGPSMarker(
    lat,
    lon,
    accuracy
) {

    if (!map) {
        return;
    }


    /*
       Create moving GPS marker once.
    */

    if (!gpsMarker) {

        gpsMarker =
            L.circleMarker(
                [
                    lat,
                    lon
                ],
                {
                    radius: 9,

                    color: "#ffffff",

                    weight: 3,

                    fillColor: "#6d5dfc",

                    fillOpacity: 1
                }
            )
            .addTo(map)
            .bindPopup(
                "<b>Your Live Location</b>"
            );

    }

    else {

        gpsMarker.setLatLng(
            [
                lat,
                lon
            ]
        );

    }


    /*
       Accuracy circle
    */

    if (!gpsAccuracyCircle) {

        gpsAccuracyCircle =
            L.circle(
                [
                    lat,
                    lon
                ],
                {
                    radius:
                        accuracy || 20,

                    color: "#6d5dfc",

                    weight: 1,

                    fillOpacity: 0.12
                }
            ).addTo(map);

    }

    else {

        gpsAccuracyCircle.setLatLng(
            [
                lat,
                lon
            ]
        );


        gpsAccuracyCircle.setRadius(
            accuracy || 20
        );

    }


    /*
       First GPS fix:
       move map to user's position.
    */

    if (
        !gpsMarker._medusaCentered
    ) {

        map.setView(
            [
                lat,
                lon
            ],
            16
        );


        gpsMarker._medusaCentered =
            true;

    }

}


/* =========================================================
   STOP LIVE GPS
   ========================================================= */

function stopLiveGPS() {

    if (
        gpsWatchId !== null
    ) {

        navigator.geolocation.clearWatch(
            gpsWatchId
        );

        gpsWatchId = null;

    }


    if (gpsMarker) {

        map.removeLayer(
            gpsMarker
        );

        gpsMarker = null;

    }


    if (gpsAccuracyCircle) {

        map.removeLayer(
            gpsAccuracyCircle
        );

        gpsAccuracyCircle = null;

    }


    const button =
        document.getElementById(
            "gps-toggle"
        );


    if (button) {

        button.textContent =
            "Start Live GPS";

    }

}


/* =========================================================
   CCTV CONTROL
   ========================================================= */

function addCCTVControl() {

    if (!map) {
        return;
    }


    const control =
        L.control({
            position: "topright"
        });


    control.onAdd =
        function () {

            const div =
                L.DomUtil.create(
                    "div",
                    "leaflet-bar"
                );


            div.style.background =
                "#17111f";

            div.style.borderRadius =
                "10px";

            div.style.overflow =
                "hidden";

            div.style.boxShadow =
                "0 3px 12px rgba(0,0,0,.35)";


            /*
               CCTV sits below GPS.
            */

            div.style.marginTop =
                "85px";


            div.innerHTML =

                '<button id="cctv-toggle" ' +

                'type="button" ' +

                'style="' +

                'border:0;' +

                'background:#17111f;' +

                'color:#fff;' +

                'padding:10px 13px;' +

                'font-weight:600;' +

                'cursor:pointer;' +

                'font-size:13px;' +

                '">' +

                "Show CCTV" +

                "</button>";


            L.DomEvent.disableClickPropagation(
                div
            );


            return div;

        };


    control.addTo(map);


    const button =
        document.getElementById(
            "cctv-toggle"
        );


    if (button) {

        button.addEventListener(
            "click",
            function () {

                toggleCCTV();

            }
        );

    }

}


/* =========================================================
   CCTV ICON
   ========================================================= */

function createCCTVIcon() {

    return L.divIcon({

        className:
            "medusa-cctv-marker",

        html:

            '<div style="' +

            'background:#17111f;' +

            'border:2px solid #ffffff;' +

            'border-radius:50%;' +

            'width:34px;' +

            'height:34px;' +

            'display:flex;' +

            'align-items:center;' +

            'justify-content:center;' +

            'font-size:17px;' +

            'box-shadow:0 2px 8px rgba(0,0,0,.55);' +

            '">' +

            "CCTV" +

            "</div>",

        iconSize: [
            34,
            34
        ],

        iconAnchor: [
            17,
            17
        ]

    });

}


/* =========================================================
   TOGGLE CCTV
   ========================================================= */

async function toggleCCTV() {

    const button =
        document.getElementById(
            "cctv-toggle"
        );


    if (cctvVisible) {

        if (cctvLayer) {

            cctvLayer.clearLayers();

        }


        cctvVisible =
            false;


        if (button) {

            button.textContent =
                "Show CCTV";

        }


        return;

    }


    if (button) {

        button.textContent =
            "Loading CCTV...";

    }


    try {

        await loadGovernmentCCTV();


        cctvVisible =
            true;


        if (button) {

            button.textContent =
                "Hide CCTV";

        }

    }

    catch (error) {

        console.error(
            "CCTV error:",
            error
        );


        if (button) {

            button.textContent =
                "Show CCTV";

        }


        alert(
            "Government CCTV data could not be loaded right now."
        );

    }

}


/* =========================================================
   LOAD GOVERNMENT CCTV
   ========================================================= */

async function loadGovernmentCCTV() {

    if (!cctvLayer) {

        cctvLayer =
            L.layerGroup()
                .addTo(map);

    }


    cctvLayer.clearLayers();


    const params =

        "?where=1%3D1" +

        "&outFields=FID,S_No_,Camera_Loc,Latitiude,Longitude,No_of_Came,HD_Quality,Night_Visi,Police_Sta" +

        "&returnGeometry=true" +

        "&f=json";


    const response =
        await fetch(
            GMDA_CCTV_URL +
            params
        );


    if (!response.ok) {

        throw new Error(
            "GMDA CCTV request failed."
        );

    }


    const data =
        await response.json();


    if (
        data.error
    ) {

        throw new Error(
            "GMDA CCTV API returned an error."
        );

    }


    const features =
        data.features || [];


    let added =
        0;


    features.forEach(
        function (feature) {

            const attributes =
                feature.attributes || {};


            const geometry =
                feature.geometry || {};


            let lat =
                geometry.y;

            let lon =
                geometry.x;


            /*
               Some records can carry
               latitude/longitude in fields.
            */

            if (
                (
                    !Number.isFinite(
                        Number(lat)
                    ) ||
                    !Number.isFinite(
                        Number(lon)
                    )
                )
            ) {

                lat =
                    attributes.Latitiude;

                lon =
                    attributes.Longitude;

            }


            lat =
                Number(lat);

            lon =
                Number(lon);


            if (
                !Number.isFinite(lat) ||
                !Number.isFinite(lon)
            ) {

                return;

            }


            /*
               Basic India/GMDA sanity check.
            */

            if (
                lat < 20 ||
                lat > 35 ||
                lon < 70 ||
                lon > 85
            ) {

                return;

            }


            let popup =

                "<b>Government CCTV</b>" +


                "<br><br>" +


                "📍 " +

                escapeHTML(
                    attributes.Camera_Loc ||
                    "Camera location not available"
                );


            if (
                attributes.No_of_Came !==
                null &&
                attributes.No_of_Came !==
                undefined
            ) {

                popup +=

                    "<br>📷 Cameras: " +

                    escapeHTML(
                        attributes.No_of_Came
                    );

            }


            if (
                attributes.HD_Quality
            ) {

                popup +=

                    "<br>HD Quality: " +

                    escapeHTML(
                        attributes.HD_Quality
                    );

            }


            if (
                attributes.Night_Visi
            ) {

                popup +=

                    "<br>Night Vision: " +

                    escapeHTML(
                        attributes.Night_Visi
                    );

            }


            if (
                attributes.Police_Sta
            ) {

                popup +=

                    "<br>Police Station: " +

                    escapeHTML(
                        attributes.Police_Sta
                    );

            }


            popup +=

                "<br><br>" +

                "<small>" +

                "Source: GMDA Government CCTV layer" +

                "</small>";


            L.marker(
                [
                    lat,
                    lon
                ],
                {
                    icon:
                        createCCTVIcon()
                }
            )
            .addTo(cctvLayer)
            .bindPopup(popup);


            added++;

        }
    );


    if (added === 0) {

        throw new Error(
            "No CCTV locations were returned."
        );

    }

}


/* =========================================================
   OPTIONAL: KEEP GPS/CCTV FUNCTIONS AVAILABLE GLOBALLY
   ========================================================= */

window.findRoutes =
    findRoutes;

window.scrollToPlanner =
    scrollToPlanner;

window.showFacilityList =
    showFacilityList;

window.focusFacility =
    focusFacility;

window.startLiveGPS =
    startLiveGPS;

window.stopLiveGPS =
    stopLiveGPS;

window.toggleCCTV =
    toggleCCTV;