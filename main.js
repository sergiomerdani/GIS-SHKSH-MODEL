import "./style.css";
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import { OSM, BingMaps, Vector as VectorSource, XYZ } from "ol/source";
import VectorLayer from "ol/layer/Vector";
import proj4 from "proj4";
import { register } from "ol/proj/proj4";
import { Projection, fromLonLat, transform } from "ol/proj";
import Tile from "ol/layer/Tile";
import TileWMS from "ol/source/TileWMS.js";
import GeoJSON from "ol/format/GeoJSON.js";
import {
  Attribution,
  defaults,
  FullScreen,
  MousePosition,
  Rotate,
} from "ol/control";
import DragRotate from "ol/interaction/DragRotate";
import {
  click,
  altKeyOnly,
  platformModifierKeyOnly,
} from "ol/events/condition";
import { toStringXY } from "ol/coordinate";
import LayerSwitcher from "ol-ext/control/LayerSwitcher";
import LayerGroup from "ol/layer/Group";
import SearchNominatim from "ol-ext/control/SearchNominatim";
import Feature from "ol/Feature";
import Overlay from "ol/Overlay.js";
import {
  Style,
  Circle as CircleStyle,
  Fill,
  Stroke,
  Text,
  RegularShape,
  Icon,
} from "ol/style";
import {
  LineString,
  MultiLineString,
  MultiPoint,
  MultiPolygon,
  Point,
  Polygon,
  Circle,
} from "ol/geom.js";
import LinearRing from "ol/geom/LinearRing";
import { getLength, getArea } from "ol/sphere";
import { Modify, Draw, Select } from "ol/interaction";
import Graticule from "ol/layer/Graticule.js";
import Geolocation from "ol/Geolocation.js";
import { DragPan } from "ol/interaction";
import PrintDialog from "ol-ext/control/PrintDialog";
import CanvasAttribution from "ol-ext/control/CanvasAttribution";
import CanvasScaleLine from "ol-ext/control/CanvasScaleLine";
import CanvasTitle from "ol-ext/control/CanvasTitle";
import ol_control_Legend from "ol-ext/control/Legend";
import ol_legend_Legend from "ol-ext/legend/Legend";
import { jsPDF } from "jspdf";
import { WMTSCapabilities } from "ol/format";
import { optionsFromCapabilities } from "ol/source/WMTS";
import WMTS from "ol/source/WMTS";
import { Chart } from "chart.js/auto";
import { getPointResolution } from "ol/proj";
import { fromCircle } from "ol/geom/Polygon";
import OL3Parser from "jsts/org/locationtech/jts/io/OL3Parser";
import WKTReader from "jsts/org/locationtech/jts/io/WKTReader";
import GeoJSONReader from "jsts/org/locationtech/jts/io/GeoJSONReader.js";
import { BufferOp } from "jsts/org/locationtech/jts/operation/buffer";

proj4.defs("EPSG:4326", "+proj=longlat +datum=WGS84 +no_defs +type=crs");
register(proj4);

proj4.defs(
  "EPSG:6870",
  "+proj=tmerc +lat_0=0 +lon_0=20 +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +towgs84=0,0,0,0,0,0,0 +units=m +no_defs +type=crs"
);
register(proj4);

proj4.defs(
  "EPSG:32634",
  "+proj=utm +zone=34 +datum=WGS84 +units=m +no_defs +type=crs"
);
register(proj4);

const wgs84Proj = new Projection({
  code: "EPSG:4326",
  units: "degrees",
  worldExtent: [-180.0, -90.0, 180.0, 90.0],
});
const krgjshProjection = new Projection({
  code: "EPSG:6870",
  extent: [-2963585.56, 3639475.76, 2404277.44, 9525908.77],
  worldExtent: [-16.1, 32.88, 40.18, 84.73],
  units: "m",
});
const proj32634 = new Projection({
  code: "EPSG:32634",
  extent: [166021.44, 0.0, 833978.56, 9329005.18],
  worldExtent: [18.0, 0.0, 24.0, 84.0],
  units: "m",
});

const krgjshCenter = fromLonLat([19.818913, 41.328608], "EPSG:6870");
const utmCenter = [413011.607371, 4564155.943308];
const wgs84Center = [19.820709, 41.33042];

//URLs

let host = "localhost";
const asigWmsUrl =
  "https://geoportal.asig.gov.al/service/kufinjt_e_njesive_administrative/wms?request=GetCapabilities";

const asigWmsService = "https://geoportal.asig.gov.al/service";

// const apiUrl = "http://${host}:8080/geoserver/rest/layergroups"; //${host}
const apiUrl = `http://${host}:8080/geoserver/rest/layergroups`; //server

function camelCase(str) {
  // Split the string into words
  const words = str.split(" ");

  // Convert the first word to lowercase
  let camelCaseStr = words[0].toLowerCase();

  // Convert the first letter of each subsequent word to uppercase and append to the result
  for (let i = 1; i < words.length; i++) {
    const word = words[i];
    camelCaseStr += word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }

  return camelCaseStr;
}

function parseLayerInfo(layerParams) {
  const parts = layerParams.split(":");
  if (parts.length !== 2) {
    throw new Error("Invalid layer name format");
  }
  const workspace2 = parts[0];
  const layerName2 = parts[1];
  const layerTitle2 = layerName2
    .split("_")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(" ");
  return { workspace2, layerName2, layerTitle2 };
}

let layerGroupName,
  layerParams,
  layersArray = [];
// Make a GET request to the API
fetch(apiUrl)
  .then((response) => {
    // Check if the response is successful (status code 200-299)
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    // Parse the response as JSON
    return response.json();
  })
  .then((data) => {
    const layerGroups = data.layerGroups.layerGroup;
    layerGroups.forEach((layerGroup) => {
      layerGroupName = layerGroup.name;
      const constLayerGroup = camelCase(layerGroupName);
      const newLayerGroup = new LayerGroup({
        layers: [],
        title: layerGroupName,
        displayInLayerSwitcher: true,
      });
      map.addLayer(newLayerGroup);
      layerGroupsArray.push(newLayerGroup);
      const apiUrlLayerGroups =
        apiUrl + "/" + encodeURIComponent(layerGroupName);

      fetch(apiUrlLayerGroups)
        .then((response) => {
          if (!response.ok) {
            throw new Error("Network response was not ok");
          }
          return response.json();
        })
        .then((data) => {
          const layers = data.layerGroup.publishables.published;
          const normalizedLayers = Array.isArray(layers) ? layers : [layers];
          normalizedLayers.forEach((layer) => {
            layerParams = layer.name;
            const { workspace2, layerName2, layerTitle2 } =
              parseLayerInfo(layerParams);
            const tileLayer = new TileLayer({
              source: new TileWMS({
                url: `http://${host}:8080/geoserver/${workspace2}/wms`,
                params: {
                  LAYERS: layerParams,
                  VERSION: "1.1.0",
                },
              }),
              visible: false,
              title: layerTitle2,
              information: "Kufiri i tokësor i republikës së Shqipërisë",
              displayInLayerSwitcher: true,
            });
            newLayerGroup.getLayers().push(tileLayer);
            layersArray.push(tileLayer);
          });
        })
        .catch((error) => {
          // Handle errors
          console.error("There was a problem with the fetch operation:", error);
        });
    });
  })
  .catch((error) => {
    // Handle errors
    console.error("There was a problem with the fetch operation:", error);
  });

//creating attribution control for ol
const attributionControl = new Attribution({
  collapsible: true,
});

// Zoom Extent ol-Control
const zoomExtentBtn = document.getElementById("zoom-extent");

zoomExtentBtn.addEventListener("click", function () {
  map
    .getView()
    .fit([2064411.259926, 4774562.534805, 2399511.191928, 5332247.093174], {
      padding: [10, 10, 10, 10], // Optional padding around the extent
      maxZoom: 18, // Optional maximum zoom level
    });
  calculateScale();
});

//Full Screen COntrol
const fullScreenControl = new FullScreen({
  tipLabel: "Click to fullscreen the map",
  className: "ol-full-screen",
});

//Zoom Slider
// const zoomSlider = new ZoomSlider();

//MousePosition Coordinates
const mousePositionControl = new MousePosition({
  coordinateFormat: function (coordinate) {
    return "KRGJSH : " + toStringXY(coordinate, 2);
  },
  className: "custom-mouse-position",
});

//Rotate COntrol
const rotate = new Rotate();

//DRAGPAN MAP
const dragPanBtn = document.getElementById("pan");

const dragPan = new DragPan({
  condition: function (event) {
    return platformModifierKeyOnly(event);
  },
});

dragPanBtn.addEventListener("click", function () {
  map.addInteraction(dragPan);
});

// Adding controls in a variable
const mapControls = [
  attributionControl,
  fullScreenControl,
  mousePositionControl,
  rotate,
  dragPan,
];

// Bing Maps Basemap Layer
const bingMaps = new TileLayer({
  source: new BingMaps({
    key: "AvHGkUYsgRR4sQJ1WmqJ879mN7gP-a59ExxkaD9KXDie-8nyYX4W9oSnG4ozmDXB",
    imagerySet: "AerialWithLabelsOnDemand", //'Aerial','RoadOnDemand','CanvasGray','AerialWithLabelsOnDemand','Aerial','Birdseye','BirdseyeV2WithLabels','CanvasDark','Road','CanvasGray'
  }),
  visible: false,
  title: "BingMaps",
  baseLayer: true,
  displayInLayerSwitcher: true,
});

const osmMap = new TileLayer({
  source: new OSM(),
  title: "OSM",
  visible: true,
  baseLayer: true,
  displayInLayerSwitcher: true,
});

//CartoDB BaseMap Layer
const cartoDBBaseLayer = new TileLayer({
  source: new XYZ({
    url: "https://{1-4}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png",
    attributions: "© CARTO",
  }),
  visible: false,
  title: "CartoDarkAll",
  baseLayer: true,
  displayInLayerSwitcher: true,
});

let baseLayerGroup;
var wmts_parser = new WMTSCapabilities();

fetch("https://geoportal.asig.gov.al/service/wmts?request=getCapabilities")
  .then(function (response) {
    return response.text();
  })
  .then(function (text) {
    var result = wmts_parser.read(text);
    var opt_ortho_2015_20 = optionsFromCapabilities(result, {
      layer: "orthophoto_2015:OrthoImagery_20cm",
      matrixSet: "EPSG:6870",
    });

    const ortho = new Tile({
      name: "Ortofoto 2015 20cm",
      shortName: "2015 20cm",
      visible: false,
      source: new WMTS(opt_ortho_2015_20),
      baseLayer: true,
      displayInLayerSwitcher: true,
    });

    baseLayerGroup.getLayers().push(ortho);
    // Now you can use the 'ortho' variable outside the fetch scope
    // For example, you can access it here or in any other part of your code
  })

  .catch(function (error) {
    // Handle errors if necessary
  });

const country = new Style({
  stroke: new Stroke({
    color: "gray",
    width: 1,
  }),
  fill: new Fill({
    color: "rgba(20,20,20,0.9)",
  }),
});

//ASIG Layers
const protectedAreas = new Tile({
  source: new TileWMS({
    url: asigWmsService + "/akzm/wms",
    params: {
      LAYERS: "zonat_e_mbrojtura_natyrore_06042023",
      VERSION: "1.1.0",
    },
  }),
  visible: false,
  title: "Zonat e Mbrojtura",
  information: "Kufiri i tokësor i republikës së Shqipërisë",
  displayInLayerSwitcher: true,
});

const naturalMonuments = new Tile({
  source: new TileWMS({
    url: asigWmsService + "/akzm/wms",
    params: {
      LAYERS: "monumentet_natyrore_07032023",
      VERSION: "1.1.0",
    },
  }),
  visible: false,
  title: "Monumente Natyrore",
  information: "Kufiri i tokësor i republikës së Shqipërisë",
  displayInLayerSwitcher: true,
});

const roadNetwork = new Tile({
  source: new TileWMS({
    url: asigWmsService + "/instituti_transportiti/wms",
    params: {
      LAYERS: "infrastruktura_rrugore_utm",
      VERSION: "1.1.0",
    },
  }),
  visible: false,
  title: "Rrjeti Rrugor",
  information: "Kufiri i tokësor i republikës së Shqipërisë",
  displayInLayerSwitcher: true,
});

const albBorders = new Tile({
  source: new TileWMS({
    url: asigWmsUrl,
    params: {
      LAYERS: "rendi_1_kufi_shteteror",
      VERSION: "1.1.0",
    },
  }),
  visible: false,
  title: "Kufi Shteteror",
  information: "Kufiri i tokësor i republikës së Shqipërisë",
  displayInLayerSwitcher: true,
});

const albRegions = new Tile({
  source: new TileWMS({
    url: asigWmsUrl,
    params: {
      LAYERS: "rendi_2_kufi_qarku_vkm360",
      VERSION: "1.1.0",
    },
  }),
  visible: false,
  title: "Qark",
  information: "Kufiri i tokësor i republikës së Shqipërisë",
  displayInLayerSwitcher: true,
});

const municipalities = new Tile({
  source: new TileWMS({
    url: asigWmsUrl,
    params: {
      LAYERS: "rendi_3_kufi_bashki_vkm360_1",
      VERSION: "1.1.0",
    },
  }),
  visible: false,
  title: "Bashki",
  information: "Kufiri i tokësor i republikës së Shqipërisë",
  displayInLayerSwitcher: true,
});

//Addresses System
const buildingsAdr = new Tile({
  source: new TileWMS({
    url: asigWmsService + "/adresar/wms",
    params: {
      LAYERS: "adr_ndertese",
      VERSION: "1.1.0",
    },
  }),
  visible: false,
  title: "Ndërtesa",
  information: "Kufiri i tokësor i republikës së Shqipërisë",
  displayInLayerSwitcher: true,
});

const enumerationAdr = new Tile({
  source: new TileWMS({
    url: asigWmsService + "/adresar/wms",
    params: {
      LAYERS: "adr_numertim",
      VERSION: "1.1.0",
    },
  }),
  visible: false,
  title: "Numërtim",
  information: "Kufiri i tokësor i republikës së Shqipërisë",
  displayInLayerSwitcher: true,
});

const roadsAdr = new Tile({
  source: new TileWMS({
    url: asigWmsService + "/adresar/wms",
    params: {
      LAYERS: "adr_rruge",
      VERSION: "1.1.0",
    },
  }),
  visible: false,
  title: "Rrugët",
  information: "Kufiri i tokësor i republikës së Shqipërisë",
  displayInLayerSwitcher: true,
});

//EXTRA LAYER FOR CRUD
const wfsLayerUrl = `http://${host}:8080/geoserver/test/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=`;
const wfsLayerUrlEnd = "&maxFeatures=50&outputFormat=application/json";

let wfsVectorLayer, wfsVectorSource;

//LAYER GROUPS
baseLayerGroup = new LayerGroup({
  layers: [cartoDBBaseLayer, bingMaps, osmMap],
  title: "Base Layers",
  information:
    "Këto shtresa shtresat bazë të hartës të cilat mund të aktivizohen veç e veç",
  displayInLayerSwitcher: true,
});

const asigLayers = new LayerGroup({
  layers: [
    albBorders,
    albRegions,
    municipalities,
    protectedAreas,
    naturalMonuments,
    roadNetwork,
  ],
  title: "ASIG Layers",
  information:
    "Këto shtresa shtresat bazë të hartës të cilat mund të aktivizohen veç e veç",
  displayInLayerSwitcher: true,
});

const addressSystem = new LayerGroup({
  layers: [buildingsAdr, enumerationAdr, roadsAdr],
  title: "Sistemi i Adresave",
  information: "Sistemi i Adresave",
  displayInLayerSwitcher: true,
});

const map = new Map({
  target: "map",
  controls: defaults({ attribution: false }).extend(mapControls),
  layers: [baseLayerGroup, asigLayers, addressSystem],
  view: new View({
    projection: "EPSG:3857",
    center: [2206144.619624, 5060991.189047],
    zoom: 5.8,
    maxZoom: 20,
  }),
});

// Creating vectorSource to store layers
const vectorSource = new VectorSource();

//DragRotate Interaction
const dragRotateInteraction = new DragRotate({
  condition: altKeyOnly,
});

map.addInteraction(dragRotateInteraction);

//__________________________________________________________________________________________
//GeoLocation Search
const geoSearch = new SearchNominatim({
  placeholder: "Kërko qytet/fshat...",
  collapsed: false,
  collapsible: false,
  url: "https://nominatim.openstreetmap.org/search?format=json&q={s}",
});

map.addControl(geoSearch);

geoSearch.on("select", function (event) {
  const selectedResultCoordinates = event.coordinate;

  // Create a temporary point feature
  const pointFeature = new Feature({
    geometry: new Point(selectedResultCoordinates),
  });

  // Add the point feature to a vector layer
  const vectorSource = new VectorSource({
    features: [pointFeature],
  });

  const vectorLayer = new VectorLayer({
    source: vectorSource,
    style: new Style({
      image: new CircleStyle({
        radius: 6,
        fill: new Fill({
          color: "red",
        }),
        stroke: new Stroke({
          color: "white",
          width: 2,
        }),
      }),
    }),
  });

  // Add the vector layer to the map
  map.addLayer(vectorLayer);
  // Remove the point feature after 1000 ms (1 second)
  setTimeout(() => {
    vectorSource.removeFeature(pointFeature);
  }, 2000);
  // Set the map view to the specified center coordinates and zoom level
  map.getView().setCenter(selectedResultCoordinates);
  map.getView().setZoom(12);
  calculateScale();

  geoSearch.clearHistory();
});

const searchBox = document.querySelector(".ol-search");

// searchBox.style.position = "absolute";
// searchBox.style.left = 0;
// searchBox.style.display = "flex";
// searchBox.style.flexDirection = "row";
// searchBox.style.flexWrap = "wrap";
// searchBox.style.width = "259px";
// searchBox.style.zIndex = 122;

// const searchWrapper = document.querySelector(".search-wrapper");

// searchWrapper.style.position = "relative";
// searchWrapper.style.zIndex = 1222;
// searchWrapper.style.top = "5px";
// searchWrapper.style.left = "5px";
// searchWrapper.style.width = "259px";
// searchWrapper.style.height = "100%";
// searchWrapper.style.display = "inline-block";

// searchWrapper.appendChild(searchBox);

//________________________________________________________________________________________________________
//Show/Hide graticule
const toggleButton = document.getElementById("graticuleButton");

let graticule; // Declare the graticule variable outside the click event listener

toggleButton.addEventListener("click", function () {
  if (graticule) {
    // Graticule already exists, remove it from the map
    map.removeControl(graticule);
    graticule = undefined; // Set graticule variable to undefined
  } else {
    // Graticule doesn't exist, create and add it to the map
    graticule = new Graticule({
      strokeStyle: new Stroke({
        color: "rgba(255, 120, 0, 0.9)",
        width: 2,
        lineDash: [0.5, 4],
      }),
      showLabels: true,
    });
    map.addControl(graticule);
  }
});
//________________________________________________________________________________________________________
//Geolocation API
const geolocationButton = document.getElementById("getGeolocation");
let isTracking = false;
const geolocation = new Geolocation();
let currentPositionLayer;
const originalButtonHTML = geolocationButton.innerHTML;

geolocationButton.addEventListener("click", function () {
  if (isTracking) {
    stopGeolocationTracking();
  } else {
    startGeolocationTracking();
  }
});

function startGeolocationTracking() {
  const viewProjection = map.getView().getProjection();

  geolocation.setTrackingOptions({
    enableHighAccuracy: true,
  });

  geolocation.setProjection(viewProjection);

  const accuracyFeature = new Feature();
  geolocation.on("change:accuracyGeometry", function () {
    accuracyFeature.setGeometry(geolocation.getAccuracyGeometry());
  });

  const currentPositionFeature = new Feature();

  geolocation.on("change:position", function () {
    let currentPosition = geolocation.getPosition();
    map.getView().setCenter(currentPosition);
    map.getView().setZoom(18);

    currentPositionFeature.setGeometry(new Point(currentPosition));
    calculateScale();
  });

  // Trigger the geolocation to start tracking
  geolocation.setTracking(true);

  // Create a vector layer to display the current position
  currentPositionLayer = new VectorLayer({
    source: new VectorSource({
      features: [currentPositionFeature, accuracyFeature],
    }),
  });

  // Add the layer to the map
  map.addLayer(currentPositionLayer);

  // Update the tracking state
  isTracking = true;
  geolocationButton.textContent = "Stop Geolocation";
}

function stopGeolocationTracking() {
  // Stop the geolocation tracking
  geolocation.setTracking(false);

  // Remove the current position layer from the map
  map.removeLayer(currentPositionLayer);

  // Update the tracking state
  isTracking = false;
  geolocationButton.innerHTML = originalButtonHTML;
}

//_________________________________________________________________________________________
// Measure and show labels
const measureLine = document.getElementById("measure-length");
const measurePolygon = document.getElementById("measure-area");
const showSegments = document.getElementById("segments");
const clearPrevious = document.getElementById("clear");

const style = new Style({
  fill: new Fill({
    color: "rgba(255, 255, 255, 0.2)",
  }),
  stroke: new Stroke({
    color: "rgba(0, 0, 0, 0.5)",
    lineDash: [10, 10],
    width: 2,
  }),
  image: new CircleStyle({
    //This is for circle style
    radius: 5,
    stroke: new Stroke({
      color: "rgba(0, 0, 0, 0.7)",
    }),
    fill: new Fill({
      color: "rgba(255, 255, 255, 0.2)",
    }),
  }),
});

const labelStyle = new Style({
  text: new Text({
    font: "14px Calibri,sans-serif",
    fill: new Fill({
      color: "rgba(255, 255, 255, 1)",
    }),
    backgroundFill: new Fill({
      color: "rgba(0, 0, 0, 0.7)",
    }),
    padding: [3, 3, 3, 3],
    textBaseline: "bottom",
    offsetY: -15,
  }),
  image: new RegularShape({
    radius: 8,
    points: 3,
    angle: Math.PI,
    displacement: [0, 10],
    fill: new Fill({
      color: "rgba(0, 0, 0, 0.7)",
    }),
  }),
});

const tipStyle = new Style({
  text: new Text({
    font: "12px Calibri,sans-serif",
    fill: new Fill({
      color: "rgba(255, 255, 255, 1)",
    }),
    backgroundFill: new Fill({
      color: "rgba(0, 0, 0, 0.4)",
    }),
    padding: [2, 2, 2, 2],
    textAlign: "left",
    offsetX: 15,
  }),
});

const modifyStyle = new Style({
  image: new CircleStyle({
    //This is for CircleStyle
    radius: 5,
    stroke: new Stroke({
      color: "rgba(0, 0, 0, 0.7)",
    }),
    fill: new Fill({
      color: "rgba(0, 0, 0, 0.4)",
    }),
  }),
  text: new Text({
    text: "Drag to modify",
    font: "12px Calibri,sans-serif",
    fill: new Fill({
      color: "rgba(255, 255, 255, 1)",
    }),
    backgroundFill: new Fill({
      color: "rgba(0, 0, 0, 0.7)",
    }),
    padding: [2, 2, 2, 2],
    textAlign: "left",
    offsetX: 15,
  }),
});

const segmentStyle = new Style({
  text: new Text({
    font: "12px Calibri,sans-serif",
    fill: new Fill({
      color: "rgba(255, 255, 255, 1)",
    }),
    backgroundFill: new Fill({
      color: "rgba(0, 0, 0, 0.4)",
    }),
    padding: [2, 2, 2, 2],
    textBaseline: "bottom",
    offsetY: -12,
  }),
  image: new RegularShape({
    radius: 6,
    points: 3,
    angle: Math.PI,
    displacement: [0, 8],
    fill: new Fill({
      color: "rgba(0, 0, 0, 0.4)",
    }),
  }),
});

const segmentStyles = [segmentStyle];

const formatLength = function (line) {
  // const transformedLine = line.clone().transform(wgs84Proj, "EPSG:3857");
  // const length = getLength(transformedLine);
  const length = getLength(line);
  let output;
  if (length > 100) {
    output = Math.round((length / 1000) * 100) / 100 + " km";
  } else {
    output = Math.round(length * 100) / 100 + " m";
  }
  return output;
};

const formatArea = function (polygon) {
  // const transformedPolygon = polygon.clone().transform(wgs84Proj, "EPSG:3857");
  // const area = getGeodesicArea(transformedPolygon);
  const area = getArea(polygon);
  let output;
  if (area > 10000) {
    output = Math.round((area / 1000000) * 100) / 100 + " km\xB2";
  } else {
    output = Math.round(area * 100) / 100 + " m\xB2";
  }
  return output;
};

const modify = new Modify({
  source: vectorSource,
  style: modifyStyle,
});

let tipPoint;

function styleFunction(feature, segments, drawType, tip) {
  const styles = [style];
  const geometry = feature.getGeometry();
  const type = geometry.getType();
  let point, label, line;
  if (!drawType || drawType === type) {
    if (type === "Polygon") {
      point = geometry.getInteriorPoint();
      label = formatArea(geometry);
      line = new LineString(geometry.getCoordinates()[0]);
    } else if (type === "LineString") {
      point = new Point(geometry.getLastCoordinate());
      label = formatLength(geometry);
      line = geometry;
    }
  }
  if (segments && line) {
    let count = 0;
    line.forEachSegment(function (a, b) {
      const segment = new LineString([a, b]);
      const label = formatLength(segment);
      if (segmentStyles.length - 1 < count) {
        segmentStyles.push(segmentStyle.clone());
      }
      const segmentPoint = new Point(segment.getCoordinateAt(0.5));
      segmentStyles[count].setGeometry(segmentPoint);
      segmentStyles[count].getText().setText(label);
      styles.push(segmentStyles[count]);
      count++;
    });
  }
  if (label) {
    labelStyle.setGeometry(point);
    labelStyle.getText().setText(label);
    styles.push(labelStyle);
  }
  if (
    tip &&
    type === "Point" &&
    !modify.getOverlay().getSource().getFeatures().length
  ) {
    tipPoint = geometry;
    tipStyle.getText().setText(tip);
    styles.push(tipStyle);
  }
  return styles;
}

let drawLine;
let drawPoly;

//Measure Line
const drawnLineSource = new VectorSource();
measureLine.addEventListener("click", function () {
  map.removeInteraction(drawPoly);
  drawnPolygonSource.clear();
  const drawType = "LineString";
  const activeTip =
    "Click to continue drawing the " +
    (drawType === "Polygon" ? "polygon" : "line");
  const idleTip = "Click to start measuring";
  let tip = idleTip;
  drawLine = new Draw({
    source: vectorSource,
    type: drawType,
    style: function (feature) {
      return styleFunction(feature, showSegments.checked, drawType, tip);
    },
  });
  drawLine.on("drawstart", function () {
    map.un("click", getXYClickListener);
    map.un("click", getInfoClickListener);
    if (clearPrevious.checked) {
      vectorSource.clear();
      drawnLineSource.clear();
    }
    modify.setActive(false);
    tip = activeTip;
  });
  drawLine.on("drawend", function (event) {
    const drawnLine = event.feature;
    drawnLineSource.addFeature(drawnLine);
    modifyStyle.setGeometry(tipPoint);
    modify.setActive(true);
    map.once("pointermove", function () {
      modifyStyle.setGeometry();
    });
    tip = idleTip;
  });
  modify.setActive(true);
  map.addInteraction(drawLine);
});

// Create a vector layer for displaying the drawn polygons
const drawnLineLayer = new VectorLayer({
  title: "Measure Line ",
  source: drawnLineSource,
  style: styleFunction,
});
map.addLayer(drawnLineLayer);

//Measure Polygon
const drawnPolygonSource = new VectorSource();
measurePolygon.addEventListener("click", function () {
  map.removeInteraction(drawLine);
  drawnLineSource.clear();
  const drawType = "Polygon";
  const activeTip =
    "Click to continue drawing the " +
    (drawType === "Polygon" ? "polygon" : "line");
  const idleTip = "Click to start measuring";
  let tip = idleTip;
  drawPoly = new Draw({
    source: vectorSource,
    type: drawType,
    style: function (feature) {
      return styleFunction(feature, showSegments.checked, drawType, tip);
    },
  });

  drawPoly.on("drawstart", function () {
    map.un("click", getXYClickListener);
    map.un("click", getInfoClickListener);
    if (clearPrevious.checked) {
      vectorSource.clear();
      drawnPolygonSource.clear();
    }
    modify.setActive(false);
    tip = activeTip;
  });
  drawPoly.on("drawend", function (event) {
    const drawnPolygon = event.feature;
    drawnPolygonSource.addFeature(drawnPolygon);
    modifyStyle.setGeometry(tipPoint);
    modify.setActive(true);
    map.once("pointermove", function () {
      modifyStyle.setGeometry();
    });
    tip = idleTip;
  });
  modify.setActive(true);
  map.addInteraction(drawPoly);
});

// Create a vector layer for displaying the drawn polygons
const drawnPolygonLayer = new VectorLayer({
  title: "Measure Polygon",
  source: drawnPolygonSource,
  style: styleFunction,
  displayInLayerSwitcher: false,
});
map.addLayer(drawnPolygonLayer);

// The displayInLayerSwitcher function
const displayInLayerSwitcher = (layer) => {
  // Check if the layer has the displayInLayerSwitcher attribute and it's set to true
  return layer.get("displayInLayerSwitcher") === true;
};

//__________________________________________________________________________________________

// Customizing layer switcher functions
let layerGroupsArray = [asigLayers, addressSystem];

const onChangeCheck = function (evt) {
  const clickedLayer = evt;
  const parentLayerGroup = findParentLayerGroup(clickedLayer);

  if (parentLayerGroup && clickedLayer.getVisible()) {
    parentLayerGroup.setVisible(true);
  } else if (parentLayerGroup && hasVisibleSubLayer(parentLayerGroup)) {
    parentLayerGroup.setVisible(false);
  }

  // Check if the clicked layer is a base layer
  const baseLayer = clickedLayer.get("title") === "Base Layers";

  try {
    if (clickedLayer instanceof LayerGroup) {
      // If clicked layer is a LayerGroup
      const layers = clickedLayer.getLayers().getArray();

      layers.forEach((subLayer) => {
        if (!baseLayer && clickedLayer.getVisible()) {
          subLayer.setVisible(true);
        } else {
          subLayer.setVisible(false);
        }
      });
    } else {
      // If clicked layer is an individual layer (TileLayer, ImageLayer, etc.)
      if (!baseLayer && clickedLayer.getVisible()) {
        clickedLayer.setVisible(true);
      } else {
        clickedLayer.setVisible(false);
      }
    }

    addItemToLegend();
    addLayerToQuery();
  } catch (error) {}
};

function findParentLayerGroup(layer) {
  let parentLayerGroup = null;

  map.getLayers().forEach((group) => {
    if (group instanceof LayerGroup) {
      const layersInGroup = group.getLayers().getArray();
      if (layersInGroup.includes(layer)) {
        parentLayerGroup = group;
        return;
      }
    }
  });

  return parentLayerGroup;
}

// Function to check if at least one sub-layer within a layer group is visible
const hasVisibleSubLayer = function (layerGroup) {
  if (!(layerGroup instanceof LayerGroup)) {
    return false;
  }
  const layers = layerGroup.getLayers().getArray();
  let isAnySubLayerVisible = false;
  layers.forEach((subLayer) => {
    if (subLayer.getVisible()) {
      isAnySubLayerVisible = true;
    }
  });
  layerGroup.setVisible(isAnySubLayerVisible);
};
// Loop through each layer group and update its visibility
layerGroupsArray.forEach((layerGroup) => {
  hasVisibleSubLayer(layerGroup);
});

const layerSwitcher = new LayerSwitcher({
  displayInLayerSwitcher: displayInLayerSwitcher,
  trash: true,
  onchangeCheck: onChangeCheck,
  show_proress: true,
  mouseover: true,
  collapsed: false,
  extent: false,
  noScroll: false,
  onextent: (e) => {
    console.log(e);
  },
  oninfo: (e) => {
    alert(e.values_.information);
  },
  selection: true,
});

map.addControl(layerSwitcher);

const treePanelHeader = document.createElement("header");
treePanelHeader.innerHTML = "PANELI I SHTRESAVE";

layerSwitcher.setHeader(treePanelHeader);

// Position the LayerSwitcherImage control on the top-right corner of the map
const layerSwitcherElement = layerSwitcher.element;
layerSwitcherElement.style.position = "absolute";
layerSwitcherElement.style.top = "50px";
layerSwitcherElement.style.right = "10px";

//_____________________________________________________________________________________________
// Display data from WMS Layer
const getInfoBtn = document.getElementById("identify");

function getInfo(event) {
  // Get the clicked coordinate
  const pixel = event.pixel;
  var coordinate = map.getCoordinateFromPixel(pixel);

  // let visibleLayers;

  // Function to read visible layers in the "Local Data" group
  function readGroupLayers(grouplayers) {
    // Get the layers of the "Local Data" layer group
    const layers = grouplayers.getLayers().getArray();
    const vlay = layers.filter((layer) => layer.getVisible()).reverse();
    // Return an array of visible layers in reverse order (uppermost layer first)
    return layers.filter((layer) => layer.getVisible()).reverse();
  }

  const maxPropertiesToShow = 10;

  const visibleLayers = [];

  // Iterate over layer groups starting from index 2
  for (let i = 2; i < layerGroupsArray.length; i++) {
    // Read layers of the current group
    const currentLayerGroup = readGroupLayers(layerGroupsArray[i]);

    // Add layers to visibleLayers array
    visibleLayers.push(...currentLayerGroup);
  }

  if (visibleLayers.length < 1) {
    const formContainer = document.querySelector(".form-container");
    formContainer.style.display = "none";
    return;
  }

  // Function to get the title of a layer
  function getLayerTitle(layer) {
    // Get the title of the layer if it exists, otherwise return an empty string
    return layer.get("title") || "";
  }

  // Helper function to get the features of a layer and show the form if features exist
  // Assuming you have an array with image filenames

  function getLayerFeatures(layer) {
    const url = layer
      .getSource()
      .getFeatureInfoUrl(
        coordinate,
        map.getView().getResolution(),
        map.getView().getProjection(),
        { INFO_FORMAT: "application/json" }
      );

    if (url) {
      fetch(url)
        .then(function (response) {
          return response.json();
        })
        .then(function (data) {
          var features = data.features;

          if (features && features.length > 0) {
            features.forEach((feature, index) => {
              var properties = feature.properties;

              var formContainer = document.createElement("div");
              formContainer.classList.add("form-container-el");

              var headerElement = document.createElement("div");
              headerElement.classList.add("form-header");
              const layerTitle = getLayerTitle(layer);
              if (layerTitle) {
                headerElement.textContent = layerTitle;
              }
              formContainer.appendChild(headerElement);

              var hrElement = document.createElement("hr");
              formContainer.appendChild(hrElement);

              var propertiesToShow = Object.keys(properties).slice(
                0,
                maxPropertiesToShow
              );

              const contentWrapper = document.createElement("div");

              const labelWrapper = document.createElement("div");
              const inputWrapper = document.createElement("div");

              propertiesToShow.forEach(function (prop) {
                var labelElement = document.createElement("label");
                labelElement.textContent = prop;
                labelElement.style.paddingBottom = "7px";
                labelElement.style.width = "auto";

                var inputElement = document.createElement("input");
                inputElement.setAttribute("readonly", "readonly");
                inputElement.value = properties[prop];
                inputElement.style.width = "auto";

                var createBr = document.createElement("br");
                labelWrapper.appendChild(labelElement);
                inputWrapper.appendChild(inputElement);
              });

              contentWrapper.style.display = "flex";
              labelWrapper.style.display = "flex";
              labelWrapper.style.flexDirection = "column";
              inputWrapper.style.display = "flex";
              inputWrapper.style.flexDirection = "column";

              contentWrapper.appendChild(labelWrapper);
              contentWrapper.appendChild(inputWrapper);
              // Check if the layer title is "shkshInstitucionet"

              formContainer.appendChild(contentWrapper);

              // Display images at the end only for "shkshInstitucionet" layer

              const existingFormContainer =
                document.querySelector(".form-container");
              existingFormContainer.innerHTML = "";
              existingFormContainer.appendChild(formContainer);
              formContainer.style.display = "block";
              existingFormContainer.style.display = "block";
            });
          } else {
            const nextLayerIndex = visibleLayers.indexOf(layer) + 1;
            if (nextLayerIndex < visibleLayers.length) {
              getLayerFeatures(visibleLayers[nextLayerIndex]);
            } else {
              const formContainer = document.querySelector(".form-container");
              formContainer.style.display = "none";
            }
          }
        })
        .catch(function (error) {
          console.error("Error:", error);
        });
    }
  }

  // Process feature information for the uppermost layer if there are multiple visible layers
  if (visibleLayers.length > 0) {
    // Start by checking the uppermost layer for features
    getLayerFeatures(visibleLayers[0]);
  }
}

function getInfoClickListener(event) {
  getInfo(event);
}

function getXYClickListener(event) {
  getXY(event);
}
getInfoBtn.addEventListener("click", function () {
  map.un("click", getXYClickListener);
  map.on("click", getInfoClickListener);
  map.removeInteraction(drawPoly);
  map.removeInteraction(drawLine);
  map.removeLayer(drawnLineLayer);
  map.removeLayer(drawnPolygonLayer);
});

//MORE RIGHT/LEFT BUTTONS
const rightBtn = document.getElementById("move-right");
const leftBtn = document.getElementById("move-left");

function moveButton(value1, value2, value3) {
  const currentCenter = map.getView().getCenter();

  if (map.getView().getZoom() < 5) {
    // Calculate the new center by moving 1000 meters to the right (east)
    const newCenter = [currentCenter[0] + value1, currentCenter[1]];
    // Set the new center to the map view
    map.getView().setCenter(newCenter);
  } else if (map.getView().getZoom() >= 5 && map.getView().getZoom() < 10) {
    // Calculate the new center by moving 1000 meters to the right (east)
    const newCenter = [currentCenter[0] + value2, currentCenter[1]];
    // Set the new center to the map view
    map.getView().setCenter(newCenter);
  } else if (map.getView().getZoom() >= 10) {
    // Calculate the new center by moving 1000 meters to the right (east)
    const newCenter = [currentCenter[0] + value3, currentCenter[1]];
    // Set the new center to the map view
    map.getView().setCenter(newCenter);
  }
}

rightBtn.addEventListener("click", function () {
  moveButton(100000, 10000, 100);
});

leftBtn.addEventListener("click", function () {
  moveButton(-100000, -10000, -100);
});

//ZOOM-IN/OUT BUTTONS
const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");

function zoomFunc(value) {
  const view = map.getView();
  const currentZoom = view.getZoom();
  const newZoom = currentZoom + value;
  view.setZoom(newZoom);
  calculateScale();
}

zoomInBtn.addEventListener("click", function () {
  zoomFunc(1);
});
zoomOutBtn.addEventListener("click", function () {
  zoomFunc(-1);
});

//GET XY COORDINATES
const getXYCoordsBtn = document.getElementById("coords");
const coordsModal = document.getElementById("myModal");
const closeModal = document.getElementsByClassName("close")[0];

function decimalToDMS(decimal) {
  const degrees = Math.floor(decimal);
  const minutesDecimal = (decimal - degrees) * 60;
  const minutes = Math.floor(minutesDecimal);
  const seconds = (minutesDecimal - minutes) * 60;
  return degrees + "° " + minutes + "' " + seconds.toFixed(2) + "''";
}

function getXY(event) {
  const krgjshCoords = event.coordinate;
  // Convert the clicked coordinate to the desired projection (e.g., EPSG:4326)
  const wgs84 = "EPSG:4326";
  const utm34N = "EPSG:32634";

  const transformedCoordinate = transform(
    krgjshCoords,
    map.getView().getProjection(),
    wgs84
  );
  const latitudeDMS = decimalToDMS(transformedCoordinate[0]);
  const longitudeDMS = decimalToDMS(transformedCoordinate[1]);
  const transformedCoordinate2 = transform(
    krgjshCoords,
    map.getView().getProjection(),
    utm34N
  );

  document.getElementById("easting").textContent = krgjshCoords[0].toFixed(2);
  document.getElementById("northing").textContent = krgjshCoords[1].toFixed(2);
  document.getElementById("easting1").textContent = latitudeDMS;
  document.getElementById("northing1").textContent = longitudeDMS;
  document.getElementById("easting2").textContent =
    transformedCoordinate2[0].toFixed(2);
  document.getElementById("northing2").textContent =
    transformedCoordinate2[1].toFixed(2);
  // Show the modal
  coordsModal.style.display = "block";
  // });
}

closeModal.addEventListener("click", function () {
  coordsModal.style.display = "none";
});

// When the user clicks anywhere outside of the modal, close it
window.onclick = function (event) {
  if (event.target == coordsModal) {
    coordsModal.style.display = "none";
  }
};
getXYCoordsBtn.addEventListener("click", function () {
  map.removeInteraction(drawPoly);
  map.removeInteraction(drawLine);
  map.removeLayer(drawnLineLayer);
  map.removeLayer(drawnPolygonLayer);

  const formContainer = document.querySelector(".form-container");
  formContainer.style.display = "none";
  map.un("click", getInfoClickListener);
  map.on("click", getXYClickListener);
});

function calculateScale() {
  const view = map.getView();

  const resolution = view.getResolution();
  const center = view.getCenter();
  const projection = view.getProjection();
  const meterPerMapUnit = projection.getMetersPerUnit();
  const mapWidth = map.getTargetElement().clientWidth;
  const mapWidthMeters = resolution * mapWidth * meterPerMapUnit;

  const dpi = 96;
  const inchesPerMeter = 39.3701;
  const scale = resolution * meterPerMapUnit * inchesPerMeter * dpi;

  const scaleInput = document.getElementById("scaleInput");
  scaleInput.value = "1:" + scale.toFixed(0);
}

function setMapScale() {
  const inputElement = document.getElementById("scaleInput");
  const scaleValue = inputElement.value.trim();

  const scaleRegex = /^1:(\d+)$/;
  const scaleMatch = scaleValue.match(scaleRegex);

  if (scaleMatch) {
    const scaleNumber = parseInt(scaleMatch[1]);
    const projection = map.getView().getProjection();
    const meterPerMapUnit = projection.getMetersPerUnit();
    const view = map.getView();
    const inchesPerMeter = 39.3701;
    const dpi = 96;
    const resolution = scaleNumber / (inchesPerMeter * dpi * meterPerMapUnit);
    view.setResolution(resolution);
  } else {
    console.error("Invalid scale format. Please use the format '1:xxxxx'.");
  }
}

// Add event listener to the input field to set the map scale
const inputElement = document.getElementById("scaleInput");
inputElement.addEventListener("keyup", function (event) {
  if (event.key === "Enter") {
    setMapScale();
  }
});

// Add event listener to the map view to update scale on change
const view = map.getView();
view.on("change", function () {
  calculateScale();
});

calculateScale();

//PRINT CONTROL

map.addControl(new CanvasAttribution({ canvas: true }));
// Add a title control
map.addControl(
  new CanvasTitle({
    title: "my title",
    visible: false,
    style: new Style({
      text: new Text({
        font: '20px "Lucida Grande",Verdana,Geneva,Lucida,Arial,Helvetica,sans-serif',
      }),
    }),
  })
);
// // Add a ScaleLine control
map.addControl(new CanvasScaleLine());

// Print control
const printControl = new PrintDialog({
  immediate: true,
  collapsed: false,
});
printControl.setSize("A4");
printControl.setOrientation("landscape");
printControl.setMargin("5");

printControl.element.click();

map.addControl(printControl);
printControl.on(["print", "error"], function (e) {
  // Print success
  if (e.image) {
    if (e.pdf) {
      // Export pdf using the print info
      var pdf = new jsPDF({
        orientation: e.print.orientation,
        unit: e.print.unit,
        format: e.print.size,
      });
      pdf.addImage(
        e.image,
        "JPEG",
        e.print.position[0],
        e.print.position[0],
        e.print.imageWidth,
        e.print.imageHeight
      );
      pdf.save(e.print.legend ? "legend.pdf" : "map.pdf");
    } else {
      // Save image as file
      e.canvas.toBlob(
        function (blob) {
          var name = "title 1"; //(e.print.legend ? 'legend.' : 'map.')+e.imageType.replace('image/','');
          saveAs(blob, name);
        },
        e.imageType,
        e.quality
      );
    }
  } else {
    console.warn("No canvas to export");
  }
});

// // Select the .ol-print button
const olPrintButton = document.querySelector(".ol-print");

// Select the container where you want to append the button (assuming it's .buttons)
const buttonsContainer = document.querySelector("#printContent");

const olPrintButtonEl = document.querySelector(".ol-print button");

olPrintButtonEl.style.display = "inline";
olPrintButtonEl.style.width = "100%";
olPrintButtonEl.style.height = "100%";
olPrintButtonEl.style.margin = 0;
olPrintButtonEl.style.opacity = 0;

olPrintButton.style.display = "inline";
olPrintButton.style.position = "absolute";
olPrintButton.style.top = "-4px";
olPrintButton.style.left = 0;
olPrintButton.style.bottom = 0;
olPrintButton.style.right = 0;
olPrintButton.style.width = "100%";
olPrintButton.style.height = "100%";

// Append the olPrintButton to the buttonsContainer
buttonsContainer.appendChild(olPrintButton);

//QUERY SELECTOR
async function fetchAndExtractKeys(layerURL) {
  const uniqueValuesMap = {};
  try {
    const response = await fetch(layerURL);
    if (!response.ok) {
      throw new Error("Network response was not ok");
    }
    const data = await response.json();
    const features = data.features;
    features.forEach((feature) => {
      const properties = feature.properties;
      for (const key in properties) {
        if (properties.hasOwnProperty(key)) {
          if (!uniqueValuesMap[key]) {
            uniqueValuesMap[key] = new Set();
          }
          uniqueValuesMap[key].add(properties[key]);
        }
      }
    });
    return uniqueValuesMap;
  } catch (error) {
    console.error("There was a problem with the fetch operation:", error);
    return null;
  }
}

let uniqueValuesMap;

async function getFields() {
  fieldSelect.innerHTML = "";
  attributeSelect.innerHTML = "";
  let fields = [];
  const selectedLayerIndex = parseInt(layerSelect.value);
  const selectedLayer = layersArray[selectedLayerIndex];
  if (selectedLayer) {
    uniqueValuesMap = await fetchAndExtractKeys(layerWFS);
  }

  if (uniqueValuesMap) {
    const allKeys = Object.keys(uniqueValuesMap);
    const filteredKeys = allKeys.filter((key) => key !== "geometry");

    filteredKeys.forEach((key) => {
      fields.push(key);
    });

    fields.forEach((value) => {
      const option = document.createElement("option");
      option.value = value;
      option.textContent = value;
      fieldSelect.appendChild(option);
    });
  }
}

// Populate the dropdown with layer names
const layerSelect = document.getElementById("layerSelect");

function addLayerToQuery() {
  layerSelect.innerHTML = "";
  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.text = "Select a layer...";
  layerSelect.appendChild(defaultOption);
  layersArray.forEach((wmsLayer, index) => {
    if (wmsLayer.getVisible()) {
      const layerToAdd = layersArray[index];
      const option = document.createElement("option");
      option.value = index;
      option.text = layerToAdd.get("title");
      layerSelect.appendChild(option);
    }
  });
}
let layerWFS;
// Event listener for layer selection change
layerSelect.addEventListener("change", function () {
  const selectedIndex = this.value;
  const selectedLayer = layersArray[selectedIndex];
  const selectedLayerSource = selectedLayer.getSource();
  const layerParams = selectedLayerSource.getParams().LAYERS;
  layerWFS = `http://${host}:8080/geoserver/test/ows?service=WFS&version=1.1.0&request=GetFeature&typeName=${layerParams}&outputFormat=json`;
  getFields();
  getAttributeValues();
  updateOperatorOptions();
});

// Function to log layer attributes to the console
const fieldSelect = document.getElementById("fieldSelect");
const attributeSelect = document.getElementById("attributeSelect");
const operatorSelect = document.getElementById("operator");

operatorSelect.addEventListener("change", () => {
  const selectedField = fieldSelect.value;
  getAttributeValues(selectedField);
});

const greaterThanOption = document.querySelector('option[value=">"]');
const lessThanOption = document.querySelector('option[value="<"]');
const equalOption = document.querySelector('option[value="="]');
const likeOption = document.querySelector('option[value="LIKE"]');

async function getAttributeValues() {
  const selectedField = fieldSelect.value;
  const selectedOperator = operatorSelect.value;

  // Get the attribute input element
  const attributeInput = document.getElementById("attributeInput");
  if (attributeInput) {
    attributeInput.remove(); // Remove existing input field
  }

  if (
    selectedOperator === "LIKE" ||
    selectedOperator === ">" ||
    selectedOperator === "<"
  ) {
    // Create and display an input field for attribute value
    const input = document.createElement("input");
    input.type = "text";
    input.id = "attributeInput";
    input.placeholder = "Enter a value";
    attributeSelect.style.display = "none"; // Hide the select field
    attributeSelect.parentNode.insertBefore(input, attributeSelect); // Insert the input field
  } else {
    // Display the select field for attribute value
    attributeSelect.style.display = "block";
    attributeSelect.innerHTML = "";
    const uniqueValuesSet = uniqueValuesMap
      ? uniqueValuesMap[selectedField]
      : null;
    if (uniqueValuesSet) {
      const uniqueValuesArray = Array.from(uniqueValuesSet);

      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = "";
      attributeSelect.appendChild(emptyOption);

      uniqueValuesArray.forEach((value) => {
        const option = document.createElement("option");
        option.value = value;
        option.textContent = value;
        attributeSelect.appendChild(option);
      });
    }
  }
}

// Event listener for field selection change
fieldSelect.addEventListener("change", function () {
  const selectedField = fieldSelect.value;
  getAttributeValues(selectedField);
  updateOperatorOptions();
});

const filterCQL = function () {
  const selectedLayerIndex = parseInt(layerSelect.value);
  const selectedLayer = layersArray[selectedLayerIndex];
  console.log(selectedLayer);
  // Check if the attribute select dropdown is hidden (number field)
  const attributeInput = document.getElementById("attributeInput");
  let targetSource = selectedLayer.getSource();

  if (targetSource) {
    const params = targetSource.getParams();
    console.log(params);
    const selectedField = fieldSelect.value;
    const selectedOperator = operatorSelect.value;
    let selectedAttribute;

    if (attributeInput) {
      selectedAttribute = attributeInput.value.toUpperCase();

      const CQLFilter =
        selectedField +
        " " +
        selectedOperator +
        " '" +
        selectedAttribute +
        "%'";

      params.CQL_FILTER = CQLFilter;
    } else {
      selectedAttribute = attributeSelect.value;

      const CQLFilter =
        selectedField + " " + selectedOperator + " '" + selectedAttribute + "'";

      params.CQL_FILTER = CQLFilter;
    }
    console.log(targetSource, selectedAttribute);
    targetSource.updateParams(params);
  }
};

// FIRST FILTER

const filterAcceptedButton = document.getElementById("filterAccepted");

filterAcceptedButton.addEventListener("click", () => {
  layersArray.forEach(function (layer) {
    // Get the source of the layer
    const source = layer.getSource();
    // Check if source exists
    if (source) {
      // Get parameters of the source
      const params = source.getParams();
      console.log(params);
      // Construct the CQL filter for the 'accepted' attribute
      const CQLFilter = "category = 'B'";
      console.log(CQLFilter);
      // Set the CQL filter in the params
      params.CQL_FILTER = CQLFilter;

      // Update the parameters of the source
      source.updateParams(params);
    }
  });
});

const resetFilter = function () {
  const selectedLayerIndex = parseInt(layerSelect.value);
  const selectedLayer = layersArray[selectedLayerIndex];

  if (selectedLayer) {
    const targetSource = selectedLayer.getSource();

    if (targetSource) {
      const params = targetSource.getParams();
      delete params.CQL_FILTER;
      targetSource.updateParams(params);
    }
  }
};

// Function to check if a field's attributes are numeric
function areAttributesNumeric(selectedField) {
  if (!selectedField || !uniqueValuesMap[selectedField]) {
    return false;
  }
  const uniqueValuesSet = uniqueValuesMap[selectedField];
  for (const value of uniqueValuesSet) {
    if (isNaN(parseFloat(value))) {
      return false;
    }
  }
  return true;
}

// Update operator options based on selected field
function updateOperatorOptions() {
  const selectedField = fieldSelect.value;
  greaterThanOption.disabled = !areAttributesNumeric(selectedField);
  lessThanOption.disabled = !areAttributesNumeric(selectedField);
  likeOption.disabled = areAttributesNumeric(selectedField);
}

// Event listener for field selection change
fieldSelect.addEventListener("change", function () {
  updateOperatorOptions();
  getAttributeValues();
});

const selectControlBtn = document.querySelector("#selectControlButton");
const selectControlForm = document.querySelector(".selectControl");

selectControlBtn.addEventListener("click", () => {
  selectControlForm.hidden = !selectControlForm.hidden;
  addLayerToQuery();
  getFields();
});

const sumbmitBtn = document.getElementById("sumbmitBtn");
const resetBtn = document.getElementById("resetBtn");

sumbmitBtn.addEventListener("click", (e) => {
  e.preventDefault();
  filterCQL();
});

resetBtn.addEventListener("click", (e) => {
  e.preventDefault();
  resetFilter();
});

//Drag Query Selector
const selectLayerControl = document.getElementById("selectControl");
dragElement(selectLayerControl);

function dragElement(elmnt) {
  var pos1 = 0,
    pos2 = 0,
    pos3 = 0,
    pos4 = 0;

  if (document.getElementById(elmnt.id + "header")) {
    document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
  } else {
    elmnt.onmousedown = dragMouseDown;
  }

  function dragMouseDown(e) {
    if (e.target.tagName !== "SELECT" && e.target.tagName !== "INPUT") {
      e.preventDefault();
    }

    pos3 = e.clientX;
    pos4 = e.clientY;

    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e.preventDefault();
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;
    elmnt.style.top = elmnt.offsetTop - pos2 + "px";
    elmnt.style.left = elmnt.offsetLeft - pos1 + "px";
  }

  function closeDragElement() {
    document.onmouseup = null;
    document.onmousemove = null;
  }
}

//WFS CRUD
let layerType,
  vectorLayer,
  source,
  layerName,
  formattedCoordinates,
  workspace,
  body,
  geometryType,
  featureIDvalue,
  draw,
  layerTitle,
  selectedLayer,
  layerGroup,
  layerParam,
  features;

layerSwitcher.on("select", (e) => {
  map.removeInteraction(draw);
  selectedLayer = e.layer;
  if (selectedLayer instanceof LayerGroup) {
    //do nothing
  } else if (selectedLayer instanceof TileLayer) {
    layerTitle = selectedLayer.get("title");
    layerParam = selectedLayer.getSource().getParams().LAYERS;
    function getLayerGroup(layer) {
      map.getLayers().forEach(function (groupLayer) {
        if (groupLayer instanceof LayerGroup) {
          if (groupLayer.getLayers().getArray().includes(layer)) {
            layerGroup = groupLayer;
          }
        }
      });
      return layerGroup;
    }
    const selectedLayerGroup = getLayerGroup(selectedLayer);
  } else {
    layerTitle = selectedLayer.get("title");
    source = selectedLayer.getSource();
    features = source.getFeatures();
    const url = source.getUrl();
    console.log(source);
    console.log(url);
    vectorLayer = selectedLayer;
    const urlParts = new URL(url);
    console.log(urlParts);
    layerParam = urlParts.searchParams.get("typeName");

    [workspace, layerName] = layerParam.split(":");
    // const workspace = urlParts.pathname.split("/")[2];

    // Construct the URL for DescribeFeatureType request
    const describeFeatureTypeUrl = `http://${host}:8080/geoserver/${workspace}/ows?service=WFS&version=1.1.0&request=DescribeFeatureType&typeName=${layerParam}`;

    // Make an AJAX request to GeoServer
    fetch(describeFeatureTypeUrl)
      .then((response) => response.text())
      .then((data) => {
        const parser = new DOMParser();
        const doc = parser.parseFromString(data, "text/xml");

        // Get all 'xsd:element' elements in the XML schema
        const elementNodes = doc.getElementsByTagName("xsd:element");

        // Loop through each 'xsd:element' to find the one with name="geom"
        for (let i = 0; i < elementNodes.length; i++) {
          const element = elementNodes[i];
          const nameAttribute = element.getAttribute("name");

          if (nameAttribute === "geom") {
            // 'geom' element found, extract its 'type' attribute
            const typeAttribute = element.getAttribute("type");
            const [, typeName] = typeAttribute.split(":");

            console.log(typeName);
            // Log the type name
            geometryType = typeName;
            if (
              geometryType === "PointPropertyType" ||
              geometryType === "MultiPointPropertyType"
            ) {
              layerType = "Point";
            } else if (geometryType === "GeometryPropertyType") {
              layerType = "Polygon";
            } else if (geometryType === "MultiLineStringPropertyType") {
              layerType = "LineString";
            }
            console.log("Layer Param: ", layerParam);
            console.log("Layer Name: ", layerName);
            console.log("Workspace: ", workspace);
            console.log("Geometry Type: ", geometryType);
            console.log("Geometry (layertype):", layerType);
            console.log("Vector Layer: ", vectorLayer);
            console.log("Vector Source: ", source);
            console.log(url);
          }
        }
      })
      .catch((error) => {
        console.error("Error fetching DescribeFeatureType:", error);
      });
  }
});

const selectFeature = document.getElementById("selectFeature");
const modifyfeature = document.getElementById("modifyFeature");

//MODIFY INTERACTION
modifyfeature.addEventListener("click", (e) => {
  if (!vectorLayer) {
    alert("Please select a layer first.");
    return;
  }
  map.removeInteraction(draw);
  const modify = new Modify({ source: source });
  map.addInteraction(modify);

  // Define a function to handle the geometry modification event
  modify.on("modifyend", function (event) {
    // Get the modified feature
    const modifiedFeature = event.features.item(0);
    // Get the modified geometry
    const modifiedGeometry = modifiedFeature.getGeometry().getCoordinates();
    if (layerType === "Polygon") {
      formattedCoordinates = modifiedGeometry[0][0]
        .map((coord) => `${coord[0]},${coord[1]}`)
        .join(" ");
      console.log(formattedCoordinates);
      body = `<wfs:Transaction service="WFS" version="1.0.0"
      xmlns:wfs="http://www.opengis.net/wfs"
      xmlns:ogc="http://www.opengis.net/ogc"
      xmlns:gml="http://www.opengis.net/gml"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.0.0/WFS-transaction.xsd">
      <wfs:Update typeName="${layerName}">
        <wfs:Property>
          <wfs:Name>geom</wfs:Name>
          <wfs:Value>
            <gml:Polygon srsName="EPSG:3857">
              <gml:outerBoundaryIs>
                <gml:LinearRing>
                  <gml:coordinates>${formattedCoordinates}</gml:coordinates>
                </gml:LinearRing>
              </gml:outerBoundaryIs>
            </gml:Polygon>
          </wfs:Value>
        </wfs:Property>
        <ogc:Filter>
          <ogc:FeatureId fid="${modifiedFeature.getId()}"/>
        </ogc:Filter>
      </wfs:Update>
    </wfs:Transaction>`;
    } else if (layerType === "LineString") {
      formattedCoordinates = modifiedGeometry
        .map((pairArray) => pairArray.map((pair) => pair.join(",")).join(" "))
        .join(" ");
      body = `<wfs:Transaction service="WFS" version="1.0.0"
        xmlns:topp="http://www.openplans.org/topp"
        xmlns:ogc="http://www.opengis.net/ogc"
        xmlns:wfs="http://www.opengis.net/wfs"
        xmlns:gml="http://www.opengis.net/gml"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.0.0/WFS-transaction.xsd">
        <wfs:Update typeName="${layerName}">
          <wfs:Property>
            <wfs:Name>geom</wfs:Name>
            <wfs:Value>
              <gml:MultiLineString srsName="http://www.opengis.net/gml/srs/epsg.xml#3857">
                <gml:lineStringMember>
                  <gml:LineString>
                    <gml:coordinates>${formattedCoordinates}</gml:coordinates>
                  </gml:LineString>
                </gml:lineStringMember>
              </gml:MultiLineString>
            </wfs:Value>
          </wfs:Property>
          <ogc:Filter>
            <ogc:FeatureId fid="${modifiedFeature.getId()}"/>
          </ogc:Filter>
        </wfs:Update>
      </wfs:Transaction>`;
    } else if (layerType === "Point") {
      formattedCoordinates = modifiedGeometry.join(",");
      body = `<wfs:Transaction service="WFS" version="1.0.0"
      xmlns:wfs="http://www.opengis.net/wfs"
      xmlns:ogc="http://www.opengis.net/ogc"
      xmlns:gml="http://www.opengis.net/gml"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.0.0/WFS-transaction.xsd">
      <wfs:Update typeName="${layerName}">
        <wfs:Property>
          <wfs:Name>geom</wfs:Name>
          <wfs:Value>
            <gml:Point srsName="EPSG:3857">
              <gml:coordinates>${formattedCoordinates}</gml:coordinates>
            </gml:Point>
          </wfs:Value>
        </wfs:Property>
        <ogc:Filter>
          <ogc:FeatureId fid="${modifiedFeature.getId()}"/>
        </ogc:Filter>
      </wfs:Update>
    </wfs:Transaction>`;
    }

    // Send a WFS Transaction request to update the geometry
    const url = `http://${host}:8080/geoserver/test/ows`;

    // Send the WFS Transaction request
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
      },
      body: body,
    })
      .then((response) => response.text())
      .then((data) => {
        console.log("Geometry updated successfully:", data);
      })
      .catch((error) => {
        console.error("Error updating geometry:", error);
      });
  });
});

//SELECT FEATURE
// Define a style for point features
const selectedPointStyle = new Style({
  image: new CircleStyle({
    radius: 6,
    fill: new Fill({
      color: "red", // Set the fill color of the circle
    }),
    stroke: new Stroke({
      color: "rgba(254, 246, 0, 1)", // Set the border color of the circle
      width: 2, // Set the border width
    }),
  }),
});
const selected = new Style({
  fill: new Fill({
    color: "rgba(254, 246, 0, 1)",
  }),
  stroke: new Stroke({
    color: "rgba(254, 246, 0, 1)",
    width: 2,
  }),
});

function selectStyle(feature) {
  const geometry = feature.getGeometry();

  // Check if the feature's geometry is a point
  if (geometry instanceof Point) {
    return selectedPointStyle; // Return the selected style for points
  } else {
    const color = feature.get("COLOR") || "#eeeeee";
    selected.getFill().setColor(color);
    return selected;
  }
}

let selectSingleClick, featureID, url, extent, selectedFeatures, aaa;

selectFeature.addEventListener("click", (e) => {
  map.removeInteraction(draw);
  map.removeInteraction(modify);
  selectSingleClick = new Select({ style: selectStyle, hitTolerance: 5 });
  map.addInteraction(selectSingleClick);
  selectSingleClick.on("select", function (event) {
    selectedFeatures = event.selected;
    var deselectedFeatures = event.deselected;

    selectedFeatures.forEach(function (feature) {
      console.log("Selected feature:", feature);
      extent = feature.getGeometry().getExtent();
      aaa = feature;
    });

    deselectedFeatures.forEach(function (feature) {
      console.log("Deselected feature:", feature);
    });
    getCenterOfExtent(extent);
  });
});

const drawFeatureWfs = document.getElementById("drawWfs");

// Draw Feature Event Listener
drawFeatureWfs.addEventListener("click", (e) => {
  if (!layerName) {
    alert("Please select a layer first.");
    return;
  }
  draw = new Draw({
    source: source,
    type: layerType,
  });

  map.addInteraction(draw);

  draw.on("drawend", function (event) {
    const feature = event.feature;
    const featureID = feature.getId();
    console.log(feature);
    // Set the ID attribute to the feature
    const coordinates = feature.getGeometry().getCoordinates();
    console.log(coordinates);
    if (layerType === "LineString") {
      // Map over the array and join each pair of coordinates with a space
      formattedCoordinates = coordinates
        .map((pair) => pair.join(","))
        .join(" ");
      console.log("Line Coordinates:", formattedCoordinates);
      body = `<wfs:Transaction service="WFS" version="1.1.0"
    xmlns:wfs="http://www.opengis.net/wfs"
    xmlns:test="http://www.openplans.org/test"
    xmlns:gml="http://www.opengis.net/gml"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.0.0/WFS-transaction.xsd http://www.openplans.org http://${host}:8080/geoserver/wfs/DescribeFeatureType?typename=test:line">
    <wfs:Insert>
      <${layerName}>
        <${workspace}:geom>
          <gml:MultiLineString srsName="http://www.opengis.net/gml/srs/epsg.xml#3857">
            <gml:lineStringMember>
              <gml:LineString>
                <gml:coordinates decimal="." cs="," ts=" ">
                ${formattedCoordinates}
                </gml:coordinates>
              </gml:LineString>
            </gml:lineStringMember>
          </gml:MultiLineString>
        </${workspace}:geom>
        <${workspace}:TYPE>alley</${workspace}:TYPE>
      </${layerName}>
    </wfs:Insert>
    </wfs:Transaction>`;
    } else if (layerType === "Polygon") {
      const formattedData = coordinates.map((set) =>
        set
          .map((coord) => coord.join(","))
          .slice(0, -1)
          .join(" ")
      );
      // Join the formatted data by newline
      formattedCoordinates = formattedData.join("\n");
      console.log("Polygon Coordinates:", formattedCoordinates);
      body = `<wfs:Transaction service="WFS" version="1.1.0"
    xmlns:wfs="http://www.opengis.net/wfs"
    xmlns:test="http://www.openplans.org/test"
    xmlns:gml="http://www.opengis.net/gml"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.0.0/WFS-transaction.xsd http://www.openplans.org http://${host}:8080/geoserver/wfs/DescribeFeatureType?typename=test:line">
    <wfs:Insert>
      <${layerName}>
        <${workspace}:geom>
          <gml:MultiLineString srsName="http://www.opengis.net/gml/srs/epsg.xml#3857">
            <gml:lineStringMember>
              <gml:LineString>
                <gml:coordinates decimal="." cs="," ts=" ">
                ${formattedCoordinates}
                </gml:coordinates>
              </gml:LineString>
            </gml:lineStringMember>
          </gml:MultiLineString>
        </${workspace}:geom>
        <${workspace}:TYPE>alley</${workspace}:TYPE>
      </${layerName}>
    </wfs:Insert>
    </wfs:Transaction>`;
    } else if (layerType === "Point") {
      formattedCoordinates = [coordinates[0], coordinates[1]].join(",");
      console.log("Point Coordinates:", formattedCoordinates);
      body = `<wfs:Transaction service="WFS" version="1.1.0"
      xmlns:wfs="http://www.opengis.net/wfs"
      xmlns:test="http://www.openplans.org/test"
      xmlns:gml="http://www.opengis.net/gml"
      xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
      xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.0.0/WFS-transaction.xsd http://www.openplans.org http://${host}:8080/geoserver/wfs/DescribeFeatureType?typename=test:line">
      <wfs:Insert>
        <${layerName}>
          <${workspace}:geom>
          <gml:Point srsDimension="2" srsName="urn:x-ogc:def:crs:EPSG:3857">
          <gml:coordinates xmlns:gml="http://www.opengis.net/gml"
          decimal="." cs="," ts=" ">${formattedCoordinates}</gml:coordinates>
          </gml:Point>
          </${workspace}:geom>
          <${workspace}:TYPE>alley</${workspace}:TYPE>
        </${layerName}>
      </wfs:Insert>
      </wfs:Transaction>`;
    }

    url = `http://${host}:8080/geoserver/test/ows`;

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
      },
      body: body,
    };

    // Make the POST request using the Fetch API
    fetch(url, options)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        // Parse the JSON response
        return response.text();
      })
      .then((data) => {
        source.refresh();

        // Handle the data returned by the server
        console.log("Response from server:", data);
      })
      .catch((error) => {
        // Handle errors that occur during the fetch request
        console.error("There was a problem with your fetch operation:", error);
      });
  });
});

// DELETE WFS Event Listener
const deleteWFS = document.getElementById("deleteWfs");
deleteWFS.addEventListener("click", (e) => {
  if (!vectorLayer) {
    alert("Please select a layer first.");
    return;
  }
  if (!selectSingleClick) {
    alert("Please select a feature first.");
    return;
  }
  const selectedFeatures = selectSingleClick.getFeatures();
  const selectedFeaturesArray = selectedFeatures.getArray();
  selectedFeaturesArray.forEach((feature) => {
    // Do something with the feature
    source.removeFeature(feature);
    const selectedFeatureValueID = feature.get("id");
    // You can perform any other operations with the feature here
    url = `http://${host}:8080/geoserver/test/ows`;
    const body = `<wfs:Transaction service="WFS" version="1.0.0"
                  xmlns:cdf="http://www.opengis.net/cite/data"
                  xmlns:ogc="http://www.opengis.net/ogc"
                  xmlns:wfs="http://www.opengis.net/wfs"
                  xmlns:topp="http://www.openplans.org/topp">
                  <wfs:Delete typeName="${layerName}">
                    <ogc:Filter>
                      <ogc:PropertyIsEqualTo>
                        <ogc:PropertyName>id</ogc:PropertyName>
                        <ogc:Literal>${selectedFeatureValueID}</ogc:Literal>
                      </ogc:PropertyIsEqualTo>
                    </ogc:Filter>
                  </wfs:Delete>
                </wfs:Transaction>`;

    const options = {
      method: "POST",
      headers: {
        "Content-Type": "text/xml",
      },
      body: body,
    };

    // Make the POST request using the Fetch API
    fetch(url, options)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        // Parse the JSON response
        return response.text();
      })
      .then((data) => {
        // Handle the data returned by the server
        console.log("Response from server:", data);
      })
      .catch((error) => {
        // Handle errors that occur during the fetch request
        console.error("There was a problem with your fetch operation:", error);
      });
  });
});

// Create a new overlay
const popup = new Overlay({
  element: document.getElementById("popup"),
  positioning: "bottom-center",
});
map.addOverlay(popup);

//GET INFO
const getInfoButton = document.getElementById("getInfo");

getInfoButton.addEventListener("click", (e) => {
  map.removeInteraction(draw);
  getFeatureInfo();
});
let layerParam2;
function getFeatureInfo() {
  const tolerance = 5;
  map.on("singleclick", function (event) {
    const coordinate = event.coordinate;
    const pixel = event.pixel;
    let featureFound = false;
    map.forEachFeatureAtPixel(
      pixel,
      function (feature, layer) {
        if (feature) {
          console.log(feature);
          featureID = feature.getId();

          source = layer.getSource();
          const features = source.getFeatures();
          const url = source.getUrl();

          vectorLayer = layer;
          // Extract workspace and layer name from the URL
          const urlParts = new URL(url);
          layerParam2 = urlParts.searchParams.get("typeName"); // Get the typeName parameter from the URL
          [workspace, layerName] = layerParam2.split(":");
          console.log(layerParam2);
          featureFound = true;
          const properties = feature.getProperties();
          updatePopupContent(properties, layer);

          const layerNameTitle = layer.get("title");
          document.getElementById("popup-title").innerText = layerNameTitle;

          popup.setPosition(coordinate);
        }
      },
      {
        hitTolerance: tolerance,
      }
    );
    if (!featureFound) {
      popup.setPosition(undefined);
    }
  });
}

// Function to update the content of the popup with feature properties
function updatePopupContent(properties, layer) {
  const popupContent = document.getElementById("popup-content");
  popupContent.innerHTML = ""; // Clear previous content

  // Set the title of the popup
  const layerNameTitle = layer.get("title");
  document.getElementById("popup-title").innerText = layerNameTitle;

  // Iterate over feature properties and generate input fields
  for (const [key, value] of Object.entries(properties)) {
    if (key !== "geometry") {
      const inputField = document.createElement("div");
      inputField.innerHTML = `
      <div>
        <label for="${key}-input">${key}: </label>
        <input type="text" id="${key}" value="${value}" ${
        key === "id" ? "readonly" : ""
      }/>
      </div>
    `;
      popupContent.appendChild(inputField);
    }
  }
}

//TRANSACTION TO SAVE DATA USING WFS
// Function to save the changes to the database using WFS transaction
function saveChanges(properties) {
  // Prepare the transaction request XML
  var transactionXML = `<wfs:Transaction service="WFS" version="1.0.0"
  xmlns:topp="http://www.openplans.org/topp"
  xmlns:ogc="http://www.opengis.net/ogc"
  xmlns:wfs="http://www.opengis.net/wfs">
    <wfs:Update typeName="${layerParam2}">`;

  // Loop through properties and add them to the transaction XML
  for (const [key, value] of Object.entries(properties)) {
    // Skip updating the "id" property
    if (key === "id") {
      continue;
    }
    transactionXML += `<wfs:Property>
        <wfs:Name>${key}</wfs:Name>
        <wfs:Value>${value}</wfs:Value>
      </wfs:Property>`;
  }
  transactionXML += `<ogc:Filter>
      <ogc:FeatureId fid="${featureID}"/>
    </ogc:Filter>
      </wfs:Update>
    </wfs:Transaction>`;

  console.log(transactionXML);
  // Send the transaction request to the WFS server
  fetch(`http://${host}:8080/geoserver/test/ows`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
    },
    body: transactionXML,
  })
    .then((response) => response.text())
    .then((data) => {
      // Handle the response from the server
      console.log("Transaction Response:", data);
      // You can show a success message or handle errors here
    })
    .catch((error) => {
      console.error("Error:", error);
    });
}

// Event listener for the save button
const saveForm = document.getElementById("saveForm");
saveForm.addEventListener("click", (e) => {
  // Prevent the default form submission behavior
  e.preventDefault();

  // Get all input fields within the form
  const inputFields = document.querySelectorAll("#popup input[type='text']");
  console.log(inputFields);
  // Create an empty object to store the updated properties
  const updatedProperties = {};

  // Loop through each input field and add its value to the updatedProperties object
  inputFields.forEach((inputField) => {
    console.log(inputField);
    // Get the field name (without the "input-" prefix)
    const fieldName = inputField.id.replace("input-", "");
    console.log(inputField.value);
    // Add the field name and its value to the updatedProperties object
    updatedProperties[fieldName] = inputField.value;
    console.log(updatedProperties[fieldName]);
  });

  // Call the saveChanges function to save the changes to the database
  saveChanges(updatedProperties);
});

//EDIT LAYER
const editLayerButton = document.getElementById("editLayer");

editLayerButton.addEventListener("click", (e) => {
  if (!selectedLayer) {
    alert("Please select a layer!");
    return;
  }
  //WFS Layer
  wfsVectorSource = new VectorSource({
    url: wfsLayerUrl + layerParam + wfsLayerUrlEnd,
    format: new GeoJSON(),
    attributions: "@geoserver",
  });

  wfsVectorLayer = new VectorLayer({
    source: wfsVectorSource,
    title: layerTitle,
    // crossOrigin: "anonymous",
    // opacity: 0,
    visible: true,
    displayInLayerSwitcher: true,
  });
  // Remove the polygon tile layer from the map
  layerGroup.getLayers().remove(selectedLayer);

  // Add the WFS vector layer to the map
  layerGroup.getLayers().push(wfsVectorLayer);
});

//SAVE TO LAYER
const saveToLayerButton = document.getElementById("saveToLayer");

//Generates property ids for each feature
saveToLayerButton.addEventListener("click", () => {
  console.log(features);

  if (!features) {
    return;
  }
  // Get all features from the vector source
  features = source.getFeatures();
  console.log(features);

  features.forEach((feature) => {
    const drawnFeatureIds = feature.getId();
    const idParts = drawnFeatureIds.split(".");
    const numberPart = idParts[1];
    updatePropertyID(numberPart);
  });
  source.refresh();
  map.removeInteraction(draw);
});

function updatePropertyID(featureID) {
  url = `http://${host}:8080/geoserver/test/ows`;
  featureIDvalue = featureID;

  var updateBody = `
    <wfs:Transaction service="WFS" version="1.1.0"
    xmlns:topp="http://www.openplans.org/topp"
    xmlns:ogc="http://www.opengis.net/ogc"
    xmlns:wfs="http://www.opengis.net/wfs">
    <wfs:Update typeName="${layerName}">
    <wfs:Property>
    <wfs:Name>id</wfs:Name>
    <wfs:Value>${featureID}</wfs:Value>
    </wfs:Property>
      <ogc:Filter>
        <ogc:FeatureId fid="${featureID}"/>
      </ogc:Filter>
    </wfs:Update>
    </wfs:Transaction>
  `;

  const updateOptions = {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
    },
    body: updateBody,
  };

  fetch(url, updateOptions)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.text();
    })
    .then((data) => {
      console.log("Property ID updated successfully:", data);
    })
    .catch((error) => {
      console.error("Error updating property ID:", error);
    });
}

//ADD and MANAGE LEGEND

let legend, newItem, clickedLayer;

const manageLegendItems = (layer) => {
  if (layer instanceof LayerGroup) {
    const layers = layer.getLayers().getArray();
    layers.forEach((subLayer) => {
      if (subLayer.getVisible()) {
        newItem = {
          title: subLayer.get("title"),
          typeGeom: "Point",
          style: new Style({
            image: new Icon({
              src: subLayer.getSource().getLegendUrl(),
              // crossOrigin: "anonymous",
            }),
          }),
        };
        legend.addItem(newItem);
      }
    });
  } else if (layer instanceof TileLayer) {
    if (layer.getVisible()) {
      newItem = {
        title: layer.get("title"),
        typeGeom: "Point",
        style: new Style({
          image: new Icon({
            src: layer.getSource().getLegendUrl(),
            // crossOrigin: "anonymous",
          }),
        }),
      };
      legend.addItem(newItem);
    }
  }
};

legend = new ol_legend_Legend({
  title: "Legjenda",
  items: [manageLegendItems()],
});
// Legend
const legendCtrl = new ol_control_Legend({
  title: "Legend",
  margin: 10,
  legend: legend,
});

map.addControl(legendCtrl);

const addItemToLegend = () => {
  legend.getItems().clear();
  layerGroupsArray.forEach((layerGroup) => {
    if (
      layerGroup.get("title") !== "ASIG Layers" &&
      layerGroup.get("title") !== "Sistemi i Adresave"
    ) {
      manageLegendItems(layerGroup);
    }
  });
};

addItemToLegend();

// DISPLAY CHART
const exportPDFButton = document.getElementById("exportPDF");
let selectedLayerInChart,
  link,
  myChart,
  selectedChartType = "bar";

const selectLayer = () => {
  const layerLabelElement = document.createElement("label");
  layerLabelElement.id = "layerDropdownLabel";
  layerLabelElement.textContent = "Layer:";
  document.body.appendChild(layerLabelElement);

  const layerDropdown = document.createElement("select");
  layerDropdown.id = "layerDropdown";

  document.body.appendChild(layerDropdown);

  layerDropdown.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.text = "Select a layer";
  layerDropdown.appendChild(defaultOption);

  layersArray.forEach((layer) => {
    const option = document.createElement("option");
    option.value = layer.getSource().getParams().LAYERS;
    option.text = option.value; // Use layer name as option text
    layerDropdown.appendChild(option);
  });

  // Event listener for layer selection
  layerDropdown.addEventListener("change", function (event) {
    selectedLayerInChart = event.target.value;

    // Update the link based on the selected layer
    link = `http://${host}:8080/geoserver/test/ows?service=WFS&version=1.0.0&request=GetFeature&typeName=${selectedLayerInChart}&maxFeatures=500&outputFormat=application/json`;

    // Generate chart and dropdowns for X-Axis and Y-Axis
    generateChart();
  });
};

const generateChart = () => {
  // Create label for X-Axis dropdown
  const xAxisLabelElement = document.createElement("label");
  xAxisLabelElement.id = "xAxisLabel";
  xAxisLabelElement.textContent = "X-Axis:";
  document.body.appendChild(xAxisLabelElement);

  // Create dropdown for X-Axis
  const xAxisDropdown = document.createElement("select");
  xAxisDropdown.id = "xAxisDropdown";
  document.body.appendChild(xAxisDropdown);

  // Create label for Y-Axis dropdown
  const yAxisLabelElement = document.createElement("label");
  yAxisLabelElement.id = "yAxisLabel";
  yAxisLabelElement.textContent = "Y-Axis:";
  document.body.appendChild(yAxisLabelElement);

  // Create dropdown for Y-Axis
  const yAxisDropdown = document.createElement("select");
  yAxisDropdown.id = "yAxisDropdown";
  document.body.appendChild(yAxisDropdown);

  const chartTypes = ["bar", "line", "radar", "polarArea"];

  const chartTypeLabel = document.createElement("label");
  chartTypeLabel.textContent = "Chart Type:";
  document.body.appendChild(chartTypeLabel);

  const chartTypeDropdown = document.createElement("select");
  chartTypeDropdown.id = "chartTypeDropdown";
  document.body.appendChild(chartTypeDropdown);

  chartTypes.forEach((type) => {
    const option = document.createElement("option");
    option.value = type;
    option.text = type;
    chartTypeDropdown.appendChild(option);
  });

  chartTypeDropdown.addEventListener("change", (e) => {
    selectedChartType = e.target.value;
  });

  const submitButton = document.createElement("button");
  submitButton.id = "submit-chart";
  submitButton.textContent = "Submit";
  document.body.appendChild(submitButton);

  submitButton.addEventListener("click", () => {
    const selectedXAxis = xAxisDropdown.value;
    const selectedYAxis = yAxisDropdown.value;
    fetch(link)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then((data) => {
        const features = data.features;
        if (myChart) {
          myChart.destroy(); // Destroy existing chart if it exists
        }
        generateChartWithAxes(features, selectedXAxis, selectedYAxis);
      })
      .catch((error) => {
        console.error("There was a problem with the fetch operation:", error);
      });
  });

  fetch(link)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      const features = data.features;
      // Populate dropdown for X-Axis with property names
      console.log(features);
      const xAxisProperties = Object.keys(features[0].properties);
      xAxisProperties.forEach((property) => {
        const option = document.createElement("option");
        option.value = property;
        option.text = property;
        xAxisDropdown.appendChild(option);
      });

      const yAxisProperties = Object.keys(features[0].properties);
      yAxisProperties.forEach((property) => {
        const option = document.createElement("option");
        option.value = property;
        option.text = property;
        yAxisDropdown.appendChild(option);
      });
    })
    .catch((error) => {
      console.error("There was a problem with the fetch operation:", error);
    });
};

const generateChartWithAxes = (features, xAxisProperty, yAxisProperty) => {
  const canvas = document.createElement("canvas");
  canvas.id = "myChart";
  document.body.appendChild(canvas);

  const ctx = document.getElementById("myChart");

  const labels = features.map((feature) => feature.properties[xAxisProperty]);
  const dataValues = features.map(
    (feature) => feature.properties[yAxisProperty]
  );

  const config = {
    type: selectedChartType,
    data: {
      labels: labels,
      datasets: [
        {
          label: "Value",
          data: dataValues,
          borderWidth: 1,
        },
      ],
    },
    options: {
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  };
  myChart = new Chart(ctx, config);
};

exportPDFButton.addEventListener("click", () => {
  selectLayer();
});

// ___________________________________________________________________________________________________________
//ADD LAYER GROUP
let layerGroupNameValue,
  selectedDropDownLayer1,
  selectedDropDownLayer,
  selectedDropDownGroup,
  selectedStyle;

const addLayerGroupButton = document.getElementById("addLayerGroupButton");

const modal = document.getElementById("addLayerGroupModal");

const span = document.getElementsByClassName("close")[1];

const layerDropdown = document.getElementById("layerDropdown");

addLayerGroupButton.addEventListener("click", function () {
  modal.style.display = "block";

  layerDropdown.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.text = "Select a layer";
  layerDropdown.appendChild(defaultOption);

  layersArray.forEach((layer) => {
    const option = document.createElement("option");
    option.value = layer.getSource().getParams().LAYERS;
    option.text = option.value; // Use layer name as option text
    layerDropdown.appendChild(option);
  });
});

span.onclick = function () {
  modal.style.display = "none";
};

layerDropdown.addEventListener("change", function () {
  selectedDropDownLayer1 = layerDropdown.value;
  console.log("Selected Layer:", selectedDropDownLayer1);
  getLayerStyle(selectedDropDownLayer1);
});

document.getElementById("submitBtn").addEventListener("click", function () {
  const layerGroupNameInput = document.getElementById("layerGroupName");
  layerGroupNameValue = layerGroupNameInput.value;
  addLayerGroup(layerGroupNameValue, selectedDropDownLayer1, selectedStyle);
  modal.style.display = "none";
});

function addLayerGroup(
  layerGroupNameValue,
  selectedDropDownLayer1,
  selectedStyle
) {
  // Send request to create layer group

  fetch(`http://${host}:8080/geoserver/rest/layergroups`, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
      Authorization: "Basic " + btoa("admin:geoserver"),
    },
    body: `<layerGroup>
    <name>${layerGroupNameValue}</name>
    <layers>
      <layer>${selectedDropDownLayer1}</layer>
    </layers>
    <styles>
      <style>${selectedStyle}</style>
    </styles>
    <bounds>
        <minx>126530.81806662556</minx>
        <maxx>4427129.1730813645</maxx>
        <miny>699492.3966753744</miny>
        <maxy>4701182.713534636</maxy>
        <crs>EPSG:6870</crs>
      </bounds>
    </layerGroup>`,
  })
    .then((response) => response.text())
    .then((data) => {
      console.log("Layer group created:", data);
    })
    .catch((error) => console.error("Error creating layer group:", error));
}

// ________________________________________________________________________
// UPDATE LAYER GROUPS

const addLayerToGroupButton = document.getElementById("updateLayerGroupBtn");

const modal2 = document.getElementById("addLayerToGroupModal");

const span2 = document.getElementsByClassName("close")[2];

addLayerToGroupButton.addEventListener("click", function () {
  modal2.style.display = "block";
  getAllLayerGroups();
  getAllLayers();
});
span2.onclick = function () {
  modal2.style.display = "none";
};
const layerGroupDropdown = document.getElementById("layerGroupDropdown");

function getAllLayerGroups() {
  fetch(`http://${host}:8080/geoserver/rest/layergroups.json`, {
    method: "GET",
    headers: {
      "Content-Type": "application/json",
      // Add any necessary authentication headers here
    },
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json(); // Parse the JSON from the response
    })
    .then((data) => {
      const layerGroupArray = data.layerGroups.layerGroup;
      console.log(layerGroupArray);

      const layerGroupName = data.layerGroups.layerGroup.map(
        (group) => group.name
      );

      layerGroupDropdown.innerHTML = "";

      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.text = "Select a Layer Group";
      layerGroupDropdown.appendChild(defaultOption);

      layerGroupName.forEach((group) => {
        const option = document.createElement("option");
        option.value = group;
        option.text = group;
        layerGroupDropdown.appendChild(option);
      });
    })
    .catch((error) => {
      console.error("There was a problem fetching layer groups:", error);
    });
}
const newLayerDropdown = document.getElementById("newLayerDropdown");

function getAllLayers() {
  newLayerDropdown.innerHTML = "";

  const defaultOption = document.createElement("option");
  defaultOption.value = "";
  defaultOption.text = "Select a layer";
  newLayerDropdown.appendChild(defaultOption);

  layersArray.forEach((layer) => {
    const option = document.createElement("option");
    option.value = layer.getSource().getParams().LAYERS;
    option.text = option.value;
    newLayerDropdown.appendChild(option);
  });
}

newLayerDropdown.addEventListener("change", function () {
  selectedDropDownLayer = newLayerDropdown.value;
});

layerGroupDropdown.addEventListener("change", function () {
  selectedDropDownGroup = layerGroupDropdown.value;
});

document.getElementById("submitButton").addEventListener("click", function () {
  updateLayerGroupWithNewLayer(selectedDropDownGroup, selectedDropDownLayer);
  getLayerStyle(selectedDropDownLayer);
  modal2.style.display = "none";
});

function updateLayerGroupWithNewLayer(
  selectedDropDownGroup,
  selectedDropDownLayer
) {
  const text = selectedDropDownLayer;
  const layerNameOnly = text.split(":")[1];
  const encodedLayerGroupName = encodeURIComponent(selectedDropDownGroup);

  fetch(
    `http://${host}:8080/geoserver/rest/layergroups/${encodedLayerGroupName}`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      const layerGroupData = data.layerGroup;

      // Ensure publishables.published is an array
      if (!Array.isArray(layerGroupData.publishables.published)) {
        layerGroupData.publishables.published = [
          layerGroupData.publishables.published,
        ];
      }
      layerGroupData.publishables.published.push({
        "@type": "layer",
        name: `${selectedDropDownLayer}`,
        href: `http://${host}:8080/geoserver/rest/workspaces/test/layers/${layerNameOnly}.json`,
      });

      // Ensure styles.style is an array
      if (!Array.isArray(layerGroupData.styles.style)) {
        layerGroupData.styles.style = [layerGroupData.styles.style];
      }
      layerGroupData.styles.style.push({
        name: `${selectedStyle}`,
        href: `http://${host}:8080/geoserver/rest/styles/${selectedStyle}.json`,
      });

      const updatedLayerGroupData = JSON.stringify({
        layerGroup: layerGroupData,
      });

      return fetch(
        `http://${host}:8080/geoserver/rest/layergroups/${encodedLayerGroupName}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
          },
          body: updatedLayerGroupData,
        }
      );
    })
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      console.log("Layer group updated successfully");
    })
    .catch((error) => {
      console.error("There was a problem updating the layer group:", error);
    });
}

function getLayerStyle(selectedDropDownLayer) {
  fetch(
    `http://${host}:8080/geoserver/rest/layers/${selectedDropDownLayer}.json`,
    {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    }
  )
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      return response.json();
    })
    .then((data) => {
      selectedStyle = data.layer.defaultStyle.name;
    })
    .catch((error) => {
      console.error("There was a problem with the fetch operation:", error);
    });
}

// ________________________________________________________________________

// map.on("singleclick", function (event) {
//   const coordinate = event.coordinate;
//   const pixel = event.pixel;

//   displayFeatureInfo(pixel);
// });

// var displayFeatureInfo = function (pixel) {
//   map.forEachFeatureAtPixel(pixel, function (feature, layer) {
//     const extent = feature.getGeometry().getExtent();
//     getCenterOfExtent(extent);
//   });
// };

let X, Y, center, polygonFromCircle;

function getCenterOfExtent(Extent) {
  X = Extent[0] + (Extent[2] - Extent[0]) / 2;
  Y = Extent[1] + (Extent[3] - Extent[1]) / 2;
  center = [X, Y];
}

var drawCircleInMeter = function (map, radius, center) {
  var view = map.getView();
  var projection = view.getProjection();
  var resolutionAtEquator = view.getResolution();
  // var center = map.getView().getCenter();
  console.log(center);
  var pointResolution = getPointResolution(
    projection,
    resolutionAtEquator,
    center
  );
  console.log(projection.getMetersPerUnit());
  var resolutionFactor = resolutionAtEquator / pointResolution;
  var radius = (radius / 1) * resolutionFactor;

  var circle = new Circle(center, radius);
  var circleFeature = new Feature(circle);

  // Create a polygon geometry from the circle geometry
  var polygon = fromCircle(circle);

  // Create a feature from the polygon geometry
  polygonFromCircle = new Feature(polygon);
  console.log(polygonFromCircle);

  var vectorSource = new VectorSource({
    projection: "EPSG:3857",
  });
  vectorSource.addFeature(circleFeature);
  var vectorLayer = new VectorLayer({
    source: vectorSource,
  });

  map.addLayer(vectorLayer);
};

document.getElementById("draw-circle").addEventListener("click", () => {
  if (layerName !== "layer_3857") {
    alert("This function is applicable only in oecm_layer");
    return;
  }
  var popup = new Overlay({
    element: document.getElementById("input-popup"), // The popup content element
    positioning: "bottom-center", // Position the popup below the button
    stopEvent: false, // Allow map interactions below the popup
  });
  map.addOverlay(popup);

  // Open the popup
  popup.setPosition(map.getView().getCenter());

  // Event listener for the submit button inside the popup
  document.getElementById("submit-btn").addEventListener("click", function () {
    var radiusInput = document.getElementById("radius-input");
    var radius = parseFloat(radiusInput.value);
    if (!isNaN(radius)) {
      // If the radius value is valid, call drawCircleInMeter function
      drawCircleInMeter(map, radius, center);
      saveBufferToLayer(polygonFromCircle);

      map.removeOverlay(popup); // Close the popup
    } else {
      alert("Please enter a valid radius."); // Show an alert if the radius value is invalid
      radiusInput.focus(); // Focus on the input field
    }
  });

  // Event listener for the close button inside the popup
  document.getElementById("close-popup").addEventListener("click", function () {
    map.removeOverlay(popup); // Close the popup when the close button is clicked
  });
  map.removeInteraction(selectSingleClick);
});

function generateCenterOfPOlygon(xCoord, yCoord) {
  var coordinates = [xCoord, yCoord];
  var pointGeometry = new Point(coordinates);

  var pointFeature = new Feature({
    geometry: pointGeometry,
  });

  var vectorLayerPoint = new VectorLayer({
    source: new VectorSource({
      features: [pointFeature],
    }),
  });

  map.addLayer(vectorLayerPoint);
}

//SAVE BUFFER IN OECM LAYER

function saveBufferToLayer(feature) {
  const coordinates = feature.getGeometry().getCoordinates();
  console.log(coordinates);
  const formattedData = coordinates.map((set) =>
    set
      .map((coord) => coord.join(","))
      .slice(0, -1)
      .join(" ")
  );
  // Join the formatted data by newline
  formattedCoordinates = formattedData.join("\n");
  console.log("Polygon Coordinates:", formattedCoordinates);
  body = `<wfs:Transaction service="WFS" version="1.1.0"
    xmlns:wfs="http://www.opengis.net/wfs"
    xmlns:test="http://www.openplans.org/test"
    xmlns:gml="http://www.opengis.net/gml"
    xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
    xsi:schemaLocation="http://www.opengis.net/wfs http://schemas.opengis.net/wfs/1.0.0/WFS-transaction.xsd http://www.openplans.org http://${host}:8080/geoserver/wfs/DescribeFeatureType?typename=test:line">
    <wfs:Insert>
      <layer_3857>
        <test:geom>
          <gml:MultiLineString srsName="http://www.opengis.net/gml/srs/epsg.xml#3857">
            <gml:lineStringMember>
              <gml:LineString>
                <gml:coordinates decimal="." cs="," ts=" ">
                ${formattedCoordinates}
                </gml:coordinates>
              </gml:LineString>
            </gml:lineStringMember>
          </gml:MultiLineString>
        </test:geom>
        <test:TYPE>alley</test:TYPE>
      </layer_3857>
    </wfs:Insert>
    </wfs:Transaction>`;

  url = `http://${host}:8080/geoserver/test/ows`;

  const options = {
    method: "POST",
    headers: {
      "Content-Type": "text/xml",
    },
    body: body,
  };

  // Make the POST request using the Fetch API
  fetch(url, options)
    .then((response) => {
      if (!response.ok) {
        throw new Error("Network response was not ok");
      }
      // Parse the JSON response
      return response.text();
    })
    .then((data) => {
      source.refresh();

      // Handle the data returned by the server
      console.log("Response from server:", data);
    })
    .catch((error) => {
      // Handle errors that occur during the fetch request
      console.error("There was a problem with your fetch operation:", error);
    });
}

document.getElementById("draw-buffer").addEventListener("click", () => {
  const parser = new OL3Parser();
  parser.inject(
    Point,
    LineString,
    LinearRing,
    Polygon,
    MultiPoint,
    MultiLineString,
    MultiPolygon
  );

  const jstsGeom = parser.read(aaa.getGeometry());

  console.log(jstsGeom);
  const buffered = BufferOp.bufferOp(jstsGeom, 80);

  const bufferedGeometry = parser.write(buffered);
  // Create a new feature with the buffered geometry
  const bufferedFeature = new Feature({
    geometry: bufferedGeometry,
  });

  // Create a vector source and add the feature to it
  const vectorSource = new VectorSource({
    features: [bufferedFeature],
  });

  // Create a vector layer and add the vector source to it
  const vectorLayer = new VectorLayer({
    source: vectorSource,
  });

  map.addLayer(vectorLayer);
});
