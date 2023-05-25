import React, { useState, useEffect, useRef } from "react";
//import { Button, Typography, Container, Box, Grid } from "@material-ui/core";
import {
  CircularProgress,
  Container,
  Box,
  Typography,
  TextField,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  Button,
  Grid,
} from "@mui/material";
import { useWeb3React } from "@web3-react/core";
import { InjectedConnector } from "@web3-react/injected-connector";
import mapboxgl from "mapbox-gl";
import MapboxClient from "@mapbox/mapbox-sdk";
import "mapbox-gl/dist/mapbox-gl.css";
import "./App.css";
import MapboxGeocoding from "@mapbox/mapbox-sdk/services/geocoding";
import { ethers } from "ethers";
import roadContractABI from "./ABIABI.json";
//import roadContractABI from "./RoadContractABISEP1.json";
//import roadContractABI from "./RoadContractABISEP.json";
//import roadContractABI from "./RoadContractABI.json";

const injectedConnector = new InjectedConnector({
  supportedChainIds: [1, 3, 4, 5, 42, 11155111, 80001],
});
//Below is Mumbai Polygon
//const roadContractAddress = "0x565abf7adE961beA2EB7591c048765Ea2b34D8D6";
//Below is Sepolia Eth
//const roadContractAddress = "0xa4a6E7BE738D59aA7De85cD09f1AE7597f080085";
//const roadContractAddress = "0x64BD15933E8291Fd72479c5aCE91058Be595Cfb1";
const roadContractAddress = "0x02AF4411cEfd7Ab349641449DDd12eaC572aBD18";
mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_ACCESS_TOKEN;
const client = MapboxClient({ accessToken: mapboxgl.accessToken });
const geoClient = MapboxGeocoding({ accessToken: mapboxgl.accessToken });
let globalRoad;
let addPathsArgs = [];
let firstCoords = true;
let roadCosts = [];
function App() {
  const [connected, setConnected] = useState(false);
  const [role, setRole] = useState("");
  const { activate, active, account, library } = useWeb3React();
  const [address, setAddress] = useState("");
  const [map, setMap] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [currentMarker, setCurrentMarker] = useState(null);
  const [nearestRoad, setNearestRoad] = useState(null);
  const [isRecording, setIsRecording] = useState(false);
  const [pathArray, setPathArray] = useState([]);
  const [totalDistance, setTotalDistance] = useState(null);
  const [mapVisible, setMapVisible] = useState(false);
  const [staticMapURL, setStaticMapURL] = useState(null);
  const [roadTripContract, setRoadTripContract] = useState(null);
  const [roadData, setRoadData] = useState([]);
  const [previousRoadNFT, setPreviousRoadNFT] = useState(null);
  const [costInUsd, setCostInUsd] = useState(0);
  const [costInLink, setCostInLink] = useState(0);

  const pathArrayRef = useRef([]);

  let roadSwitch = false;
  let triggerRoad = null;
  let triggerId = null;
  let triggerCoordinateMin = null;
  let triggerCoordinateMax = null;
  let logicRoute = 1;
  let pendingCheck = null;

  useEffect(() => {
    if (mapVisible && userLocation) {
      initializeMap(userLocation);
    }
  }, [mapVisible, userLocation]);

  useEffect(() => {
    if (account) {
      console.log("Account:", account);
      setAddress(account);
      fetchRoadDataAndOwners();
    }
  }, [account]);

  const connectWallet = async () => {
    console.log("connecting to wallet...");
    try {
      await activate(injectedConnector);
      console.log("Wallet connected");
      console.log("Account:", account);
      setConnected(true);
    } catch (error) {
      console.error("Failed to connect:", error);
    }
  };

  const selectRole = (selectedRole) => {
    setRole(selectedRole);
  };

  useEffect(() => {
    if (library && account) {
      const contract = new ethers.Contract(
        roadContractAddress,
        roadContractABI,
        library.getSigner()
      );
      setRoadTripContract(contract);
    }
  }, [library, account]);

  const fetchRoadDataAndOwners = async () => {
    if (library && account) {
      const contract = new ethers.Contract(
        roadContractAddress,
        roadContractABI,
        library.getSigner()
      );
      const roadCount = await contract.totalSupply();

      const newRoadData = []; // Create a local array to store road data
      const roadOwners = [];

      for (let i = 0; i < roadCount; i++) {
        const roadTokenId = await contract.tokenByIndex(i);
        const roadOwner = await contract.ownerOf(roadTokenId);
        const roadUri = await contract.tokenURI(roadTokenId);

        const response = await fetch(roadUri);
        const roadMetadata = await response.json();

        newRoadData.push(roadMetadata); // Push to the local array
        roadOwners.push(roadOwner);
      }

      setRoadData(newRoadData); // Update the state with the collected data

      //assign costs
      for (let i = 0; i < newRoadData.length; i++) {
        let road = newRoadData[i];
        let costPerMileAttribute = road.attributes.find(
          (attr) => attr.trait_type === "Cost Per Mile (WEI)"
        );
        if (costPerMileAttribute) {
          roadCosts[i] = Number(costPerMileAttribute.value);
        }
      }
      console.log("Road costs is: ", roadCosts);

      console.log(`${newRoadData.length} Road Assets Collected.`);
      console.log("Road Data:", newRoadData);
      console.log("Road Owners:", roadOwners);
      console.log("Road Data[0]:", newRoadData[0]);
      console.log("Road Owners[0]:", roadOwners[0]);
    }
  };

  const updateMap = (location) => {
    if (map) {
      map.jumpTo({ center: [location.longitude, location.latitude] });

      if (currentMarker) {
        currentMarker.remove();
      }

      const marker = new mapboxgl.Marker()
        .setLngLat([location.longitude, location.latitude])
        .addTo(map);
      setCurrentMarker(marker);
    }
  };

  // const updateLocation = async (location) => {
  //   setUserLocation(location);
  //   checkIfOnRoadPiece(location, roadData);
  //   if (isRecording) {
  //     setPathArray((prevPathArray) => [...prevPathArray, location]);
  //     console.log("The current path array is: ", pathArray);
  //   }
  // };

  const updateLocation = async (location) => {
    setUserLocation(location);
    await checkIfOnRoadPiece(location, roadData);
  };
  // useEffect(() => {
  //   if (isRecording) {
  //     setPathArray((prevPathArray) => [...prevPathArray, userLocation]);
  //     console.log("The current path array is: ", pathArray);
  //   }
  // }, [isRecording, userLocation]);
  useEffect(() => {
    if (isRecording) {
      pathArrayRef.current = [...pathArrayRef.current, userLocation];
      console.log("The current path array is: ", pathArrayRef.current);
    }
  }, [isRecording, userLocation]);

  const checkIfOnRoadPiece = (location, roadData) => {
    const firstRoad = roadData[0];
    const secondRoad = roadData[1];
    const thirdRoad = roadData[2];
    const fourthRoad = roadData[3];
    const nameAttribute = firstRoad.attributes.find(
      (attr) => attr.trait_type === "Name String"
    );
    const secondNameAttribute = secondRoad.attributes.find(
      (attr) => attr.trait_type === "Name String"
    );
    const thirdNameAttribute = thirdRoad.attributes.find(
      (attr) => attr.trait_type === "Name String"
    );
    const fourthNameAttribute = fourthRoad.attributes.find(
      (attr) => attr.trait_type === "Name String"
    );
    const longMaxAttribute = firstRoad.attributes.find(
      (attr) => attr.trait_type === "Longitude Maximum"
    );
    const secondLongMaxAttribute = secondRoad.attributes.find(
      (attr) => attr.trait_type === "Longitude Maximum"
    );
    const longMinAttribute = firstRoad.attributes.find(
      (attr) => attr.trait_type === "Longitude Minimum"
    );
    const secondLongMinAttribute = secondRoad.attributes.find(
      (attr) => attr.trait_type === "Longitude Minimum"
    );
    const thirdLatMinAttribute = thirdRoad.attributes.find(
      (attr) => attr.trait_type === "Latitude Minimum"
    );
    const thirdLatMaxAttribute = thirdRoad.attributes.find(
      (attr) => attr.trait_type === "Latitude Maximum"
    );
    const fourthLatMinAttribute = fourthRoad.attributes.find(
      (attr) => attr.trait_type === "Latitude Minimum"
    );
    const fourthLatMaxAttribute = fourthRoad.attributes.find(
      (attr) => attr.trait_type === "Latitude Maximum"
    );
    const firstName = nameAttribute.value;
    const secondName = secondNameAttribute.value;
    const thirdName = thirdNameAttribute.value;
    const fourthName = fourthNameAttribute.value;

    const firstLongMin = longMinAttribute.value;
    const firstLongMax = longMaxAttribute.value;
    const secondLongMin = secondLongMinAttribute.value;
    const secondLongMax = secondLongMaxAttribute.value;

    const thirdLatMin = thirdLatMinAttribute.value;
    const thirdLatMax = thirdLatMaxAttribute.value;
    const fourthLatMin = fourthLatMinAttribute.value;
    const fourthLatMax = fourthLatMaxAttribute.value;

    if (!roadSwitch) {
      if (globalRoad && globalRoad.includes(firstName) && !roadSwitch) {
        if (
          location.longitude >= Number(firstLongMin) &&
          location.longitude <= Number(firstLongMax)
        ) {
          roadSwitch = true;
          triggerRoad = firstName;
          triggerId = 1;
          triggerCoordinateMin = firstLongMin;
          triggerCoordinateMax = firstLongMax;
          logicRoute = 1;
          console.log("****ROAD SWITCH TURNED ON****, TriggerID = ", triggerId);
          startRecording();
        }
      }
      if (globalRoad && globalRoad.includes(secondName) && !roadSwitch) {
        if (
          location.longitude >= Number(secondLongMin) &&
          location.longitude <= Number(secondLongMax)
        ) {
          roadSwitch = true;
          triggerRoad = secondName;
          triggerId = 2;
          triggerCoordinateMin = secondLongMin;
          triggerCoordinateMax = secondLongMax;
          logicRoute = 1;
          console.log("****ROAD SWITCH TURNED ON****, TriggerID = ", triggerId);
          startRecording();
        }
      }
      if (globalRoad && globalRoad.includes(thirdName) && !roadSwitch) {
        if (
          location.latitude >= Number(thirdLatMin) &&
          location.latitude <= Number(thirdLatMax)
        ) {
          roadSwitch = true;
          triggerRoad = thirdName;
          triggerId = 3;
          triggerCoordinateMin = thirdLatMin;
          triggerCoordinateMax = thirdLatMax;
          logicRoute = 2;
          console.log("****ROAD SWITCH TURNED ON****, TriggerID = ", triggerId);
          startRecording();
        }
      }
      if (globalRoad && globalRoad.includes(fourthName) && !roadSwitch) {
        if (
          location.latitude >= Number(fourthLatMin) &&
          location.latitude <= Number(fourthLatMax)
        ) {
          roadSwitch = true;
          triggerRoad = fourthName;
          triggerId = 4;
          triggerCoordinateMin = fourthLatMin;
          triggerCoordinateMax = fourthLatMax;
          logicRoute = 2;
          console.log("****ROAD SWITCH TURNED ON****, TriggerID = ", triggerId);
          startRecording();
        }
      }
    } else if (
      (roadSwitch && !globalRoad.includes(triggerRoad) && logicRoute === 1) ||
      (roadSwitch &&
        location.longitude < triggerCoordinateMin &&
        logicRoute === 1) ||
      (roadSwitch &&
        location.longitude > triggerCoordinateMax &&
        logicRoute === 1)
    ) {
      roadSwitch = false;
      console.log("****ROAD SWITCH TURNED OFF****");
      stopRecording();
      console.log("This is being called AFTER stop recording");
    } else if (
      (roadSwitch && !globalRoad.includes(triggerRoad) && logicRoute === 2) ||
      (roadSwitch &&
        location.latitude < triggerCoordinateMin &&
        logicRoute === 2) ||
      (roadSwitch &&
        location.latitude > triggerCoordinateMax &&
        logicRoute === 2)
    ) {
      roadSwitch = false;
      console.log("****ROAD SWITCH TURNED OFF****");
      stopRecording();
    }
  };

  const initializeMap = (location, callback) => {
    const map = new mapboxgl.Map({
      container: "map",
      style: "mapbox://styles/mapbox/outdoors-v11",
      center: [userLocation.longitude, userLocation.latitude],
      zoom: 1,
    });

    map.on("load", () => {
      setMap(map);
      map.resize();

      if (callback) {
        callback();
      }
    });

    const marker = new mapboxgl.Marker()
      .setLngLat([location.longitude, location.latitude])
      .addTo(map);
    setCurrentMarker(marker);
  };

  // const startRecording = () => {
  //   setIsRecording(true, () => {
  //     setPathArray([]);
  //   });
  // };
  // const startRecording = () => {   //this one was best
  //   setIsRecording(true);
  //   setPathArray([]);
  // };
  const startRecording = () => {
    setIsRecording(true);
    pathArrayRef.current = [];
  };

  const drawPath = (coordinates) => {
    if (map) {
      map.addSource("route", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "LineString",
            coordinates: coordinates,
          },
        },
      });

      map.addLayer({
        id: "route",
        type: "line",
        source: "route",
        layout: {
          "line-join": "round",
          "line-cap": "round",
        },
        paint: {
          "line-color": "#888",
          "line-width": 4,
        },
      });
    }
  };

  // const stopRecording = () => {
  //   console.log("Path array before stopping:", pathArray);
  //   setIsRecording(false);
  //   const distance = calculateTotalDistance(pathArray);
  //   setTotalDistance(distance);
  //   console.log("Path array AFTER stopping:", pathArray);
  //   console.log("Total distance:", distance);

  //   // Generate static map URL using Mapbox Static Images API
  //   const coordinates = pathArray.map(
  //     (location) => `${location.longitude},${location.latitude}`
  //   );
  //   const staticImageUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/path-4+0000FF-1(${encodeURIComponent(
  //     coordinates.join(";")
  //   )})/auto/1000x500?access_token=${mapboxgl.accessToken}`;
  //   setStaticMapURL(staticImageUrl);
  // };
  const stopRecording = async () => {
    //console.log("Path array before stopping:", pathArrayRef.current);
    setIsRecording(false);
    const distance = calculateTotalDistance(pathArrayRef.current);
    setTotalDistance(distance);
    //console.log("Path array AFTER stopping:", pathArrayRef.current);
    //console.log("Total distance:", distance);

    // Generate static map URL using Mapbox Static Images API
    const coordinates = pathArrayRef.current.map(
      (location) => `${location.longitude},${location.latitude}`
    );
    const staticImageUrl = `https://api.mapbox.com/styles/v1/mapbox/streets-v11/static/path-4+0000FF-1(${encodeURIComponent(
      coordinates.join(";")
    )})/auto/1000x500?access_token=${mapboxgl.accessToken}`;
    setStaticMapURL(staticImageUrl);

    const startingLocation = pathArrayRef.current[0];
    const endingLocation =
      pathArrayRef.current[pathArrayRef.current.length - 1];

    // Call the addPath function of your contract
    // await roadTripContract.addPath(
    //   1, // replace with the actual road ID
    //   scaleCoordinate(startingLocation.latitude, "latitude"),
    //   scaleCoordinate(startingLocation.longitude, "longitude"),
    //   scaleCoordinate(endingLocation.latitude, "latitude"),
    //   scaleCoordinate(endingLocation.longitude, "longitude"),
    //   scaleDistance(distance)
    // );
    addPathsArgs.push([
      triggerId,
      scaleCoordinate(startingLocation.latitude, "latitude"),
      scaleCoordinate(startingLocation.longitude, "longitude"),
      scaleCoordinate(endingLocation.latitude, "latitude"),
      scaleCoordinate(endingLocation.longitude, "longitude"),
      scaleDistance(distance),
    ]);
    console.log("The current addPaths args array is: ", addPathsArgs);
    pathArrayRef.current = []; // Reset pathArrayRef
  };

  const calculateTotalDistance = (pathArray) => {
    let distance = 0;
    for (let i = 1; i < pathArray.length; i++) {
      distance += haversineDistance(pathArray[i - 1], pathArray[i]);
    }
    return distance;
  };

  const haversineDistance = (location1, location2) => {
    const R = 6371; // Radius of the Earth in km
    const dLat = toRad(location2.latitude - location1.latitude);
    const dLon = toRad(location2.longitude - location1.longitude);
    const lat1 = toRad(location1.latitude);
    const lat2 = toRad(location2.latitude);

    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c;
    return d;
  };

  const toRad = (value) => {
    return (value * Math.PI) / 180;
  };

  const getNearestRoad = async (location) => {
    const response = await geoClient
      .reverseGeocode({
        query: [location.longitude, location.latitude],
        types: ["address"],
        limit: 1,
      })
      .send();

    const addressFeature = response.body.features.find((feature) =>
      feature.place_type.includes("address")
    );

    if (addressFeature) {
      setNearestRoad(addressFeature.text);
      globalRoad = addressFeature.text;
      console.log("Road:", addressFeature.text);
    } else {
      setNearestRoad("No road found");
      console.log("Road: No road found");
    }
    //setPathArray([]);
  };

  function scaleCoordinate(coordinate, type = "latitude") {
    // If it's a longitude value, shift it by 180 to make it positive
    // If it's a latitude value, shift it by 90 to make it positive
    if (type === "longitude") {
      coordinate += 180;
    } else if (type === "latitude") {
      coordinate += 90;
    }

    return Math.round(coordinate * 10000000);
  }
  //1307582350
  function scaleDistance(distance) {
    return Math.round(distance * 10000);
  }
  //then when calling addPath from smart contract can do:
  //roadTripContract.addPath(0, scaleCoordinate(40.7593562, "latitude"), scaleCoordinate(-111.8725349, "longitude"), scaleCoordinate(40.760657, "latitude"), scaleCoordinate(-111.888255, "longitude"), scaleDistance(1.332));
  useEffect(() => {
    if (role === "driver") {
      const getUserLocation = () => {
        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              const location = {
                latitude: position.coords.latitude,
                longitude: position.coords.longitude,
              };
              if (firstCoords) {
                firstCoords = false;
                // Call the function with a driver address
                displayTrips("0x924FA9B0565848a50Cc3e555eB5263a8288629f9");
                roadTripContract.ignitionOn(
                  scaleCoordinate(location.latitude, "latitude"),
                  scaleCoordinate(location.longitude, "longitude")
                );
              }
              updateLocation(location);
              // if (!map && mapVisible) {
              //   initializeMap(location);
              // }
              getNearestRoad(location);
            },
            (error) => {
              console.error("Error getting location:", error);
            },
            {
              enableHighAccuracy: true,
              timeout: 5000,
              maximumAge: 0,
            }
          );
        } else {
          console.error("Geolocation is not supported by this browser.");
        }
      };

      if (isRecording) {
        const locationInterval = setInterval(() => {
          getUserLocation();
        }, 1000); // 1000 ms (1 second)

        // Cleanup function to clear the interval when the component is unmounted or when the role or isRecording state changes
        return () => {
          clearInterval(locationInterval);
        };
      } else {
        const locationInterval = setInterval(() => {
          getUserLocation();
        }, 2000); // 1000 ms (1 second)
        return () => {
          clearInterval(locationInterval);
        };
      }
    }
  }, [role, mapVisible, isRecording, map]);

  useEffect(() => {
    if (pathArray.length > 0 && map) {
      drawPath(
        pathArray.map((location) => [location.longitude, location.latitude])
      );
    }
  }, [pathArray, map]);

  async function displayTrips(driverAddress) {
    const trips = await roadTripContract.tripsTakenByDriver(driverAddress);
    console.log(trips);
    // ...
  }

  const ignitionOff = async () => {
    let ethUsdPrice = await roadTripContract.getLatestPrice(
      "0x694AA1769357215DE4FAC081bf1f309aDC325306"
    );
    let linkUsdPrice = await roadTripContract.getLatestPrice(
      "0xc59E3633BAAC79493d908e63626716e204A45EdF"
    );

    console.log("eth price: ", ethUsdPrice);
    console.log("link price: ", linkUsdPrice);
    let totalCostWei = 0;
    for (let i = 0; i < addPathsArgs.length; i++) {
      let distanceMiles = addPathsArgs[i][5];
      let costPerMile = roadCosts[addPathsArgs[i][0] - 1];
      console.log("Cost per mile is: ", costPerMile);
      console.log("type of costPerMile is: ", typeof costPerMile);
      totalCostWei += distanceMiles * costPerMile;
    }
    totalCostWei = totalCostWei / 1000;
    console.log("Total Cost Wei: ", totalCostWei);
    //const weiAmount = ethers.parseUnits("82739890000000", "wei");
    //await roadTripContract.ignitionOff({ value: weiAmount });
    let roadIds = addPathsArgs.map((path) => path[0]);
    let startingLats = addPathsArgs.map((path) => path[1]);
    let startingLons = addPathsArgs.map((path) => path[2]);
    let endingLats = addPathsArgs.map((path) => path[3]);
    let endingLons = addPathsArgs.map((path) => path[4]);
    let distances = addPathsArgs.map((path) => path[5]);
    await roadTripContract.ignitionOff(
      roadIds,
      startingLats,
      startingLons,
      endingLats,
      endingLons,
      distances,
      { value: totalCostWei }
    );

    //const totalCostEth = ethers.formatEther(totalCostWei.toString());
    const totalCostUsd =
      (Number(totalCostWei) / 100000000000000 / 1000000000000) *
      Number(ethUsdPrice);

    //totalCostUsd = totalCostUsd.toFixed(4);
    const totalCostLink =
      Number(totalCostUsd) / (Number(linkUsdPrice) / 100000000);

    console.log("total cost in usd for trip is: $", totalCostUsd.toFixed(4));
    console.log(
      `total cost for trip in Link is: ${totalCostLink.toFixed(8)} LINK`
    );
    // console.log("RoadIds = ", roadIds);
    // console.log("starting Lats = ", startingLats);
    // console.log("starting Lons = ", startingLons);
    // console.log("ending Lats = ", endingLats);
    // console.log("ending lons = ", endingLons);
    // console.log("distances = ", distances);
  };

  return (
    <Box
      sx={{
        backgroundImage: `url(https://assets-global.website-files.com/5f6b7190899f41fb70882d08/5f85cf0e9a917f5c41b4cca5_homepage-hero-2880-min.webp)`,
        backgroundRepeat: "no-repeat",
        backgroundSize: "cover",
        minHeight: "100vh", // This ensures that the background image will cover the full height of the viewport
      }}
    >
      <Box
        sx={{
          backgroundColor: "rgba(0, 0, 0, 0.5)", // Semi-transparent black
          minHeight: "100vh",
        }}
      >
        <Container>
          {!active && !connected ? (
            <Box my={4}>
              <Typography variant="h3" gutterBottom color="white">
                Welcome to Via Dappia! Please connect your wallet
              </Typography>
              <Button
                variant="contained"
                color="primary"
                onClick={connectWallet}
              >
                Connect Wallet
              </Button>
            </Box>
          ) : (
            <Box my={4}>
              <Typography variant="h3" gutterBottom color="white">
                Welcome to Via Dappia! Please select your role
              </Typography>
              <Typography variant="body1" color="white">
                You are currently connected with: {address}
              </Typography>
              <Grid container spacing={3} mt={2}>
                <Grid item>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={() => selectRole("driver")}
                  >
                    I'm a driver
                  </Button>
                </Grid>
                <Grid item>
                  <Button
                    variant="contained"
                    color="secondary"
                    onClick={() => selectRole("roadOwner")}
                  >
                    I'm a road owner
                  </Button>
                </Grid>
              </Grid>

              {role === "driver" && (
                <Box my={4}>
                  <Button
                    variant="contained"
                    color="primary"
                    onClick={ignitionOff}
                  >
                    Ignition Off
                  </Button>
                  {totalDistance !== null && (
                    <Typography variant="h5" color="white">
                      Total distance: {totalDistance.toFixed(4)} km
                    </Typography>
                  )}
                </Box>
              )}

              {role === "roadOwner" && (
                <Box my={4}>
                  <Typography variant="h4" color="white">
                    Welcome, road owner!
                  </Typography>
                </Box>
              )}

              {userLocation && (
                <Box my={4}>
                  <Typography variant="h5" color="white">
                    Current Location: ({userLocation.latitude.toFixed(6)},{" "}
                    {userLocation.longitude.toFixed(6)})
                  </Typography>
                  <Typography variant="h5" color="white">
                    Nearest road: {nearestRoad}
                  </Typography>
                </Box>
              )}

              {mapVisible ||
                (isRecording && (
                  <Box my={4}>
                    <div className="mapContainer">
                      <div
                        id="map"
                        style={{ width: "100%", height: "500px" }}
                      />
                    </div>
                  </Box>
                ))}
            </Box>
          )}
          {staticMapURL && (
            <Box my={4}>
              <img src={staticMapURL} alt="Static Map" />
            </Box>
          )}
        </Container>
      </Box>
    </Box>
  );
}

export default App;
