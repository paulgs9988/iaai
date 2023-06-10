// SPDX-License-Identifier: MIT
pragma solidity ^0.8.7;

import "@openzeppelin/contracts-upgradeable/token/ERC721/ERC721Upgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/extensions/ERC721URIStorageUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import "@chainlink/contracts/src/v0.8/interfaces/AggregatorV3Interface.sol";

contract RoadNFT is
    Initializable,
    ERC721Upgradeable,
    ERC721URIStorageUpgradeable
{
    uint256 private _tokenIdCounter;

    struct Road {
        address owner;
        uint256 id;
        uint256 costPerMile;
        uint256 latMin;
        uint256 latMax;
        uint256 longMin;
        uint256 longMax;
        string roadName;
    }

    Road[] public roads;

    // Trip Information struct for external usage
    struct TripInfo {
        uint256 startTime;
        uint256 endTime;
        uint256 startingLat;
        uint256 startingLon;
        uint256 totalCost;
        PathInfo[] paths;
    }

    // Path Information struct for external usage
    struct PathInfo {
        uint256 roadId;
        string roadName;
        uint256 costPerMile;
        address owner;
        uint256 startingLat;
        uint256 startingLon;
        uint256 endingLat;
        uint256 endingLon;
        uint256 distance;
    }

    event PaymentDebug(uint256 cost, address owner);

    function initialize() public initializer {
        __ERC721_init("ErNieFT", "ERNIE");
    }

    event RoadMinted(address indexed to, uint256 indexed tokenId);

    function mintRoad(
        address to,
        string memory _tokenURI,
        uint256 costPerMile,
        uint256 latMin,
        uint256 latMax,
        uint256 longMin,
        uint256 longMax,
        string memory roadName
    ) public {
        _tokenIdCounter += 1;
        uint256 tokenId = _tokenIdCounter;
        _mint(to, tokenId);
        _setTokenURI(tokenId, _tokenURI);
        roads.push(
            Road({
                owner: to,
                id: tokenId,
                costPerMile: costPerMile,
                latMin: latMin,
                latMax: latMax,
                longMin: longMin,
                longMax: longMax,
                roadName: roadName
            })
        );
        emit RoadMinted(to, tokenId);
    }

    function _burn(
        uint256 tokenId
    )
        internal
        virtual
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
    {
        super._burn(tokenId);
    }

    function tokenURI(
        uint256 tokenId
    )
        public
        view
        virtual
        override(ERC721Upgradeable, ERC721URIStorageUpgradeable)
        returns (string memory)
    {
        return super.tokenURI(tokenId);
    }

    function totalSupply() public view returns (uint256) {
        return _tokenIdCounter;
    }

    function tokenByIndex(uint256 index) public view returns (uint256) {
        require(index < totalSupply(), "Index out of bounds");
        return index + 1;
    }

    function ownerOf(uint256 tokenId) public view override returns (address) {
        return super.ownerOf(tokenId);
    }

    // RoadTrip functionality

    // Define the Path struct
    struct Path {
        uint256 roadId;
        string roadName;
        uint256 costPerMile;
        address owner;
        uint256 startingLat;
        uint256 startingLon;
        uint256 endingLat;
        uint256 endingLon;
        uint256 distance;
    }

    // Define the Trip struct
    struct Trip {
        uint256 startTime;
        uint256 endTime;
        uint256 startingLat;
        uint256 startingLon;
        uint256 totalCost;
        Path[] paths;
    }

    // Store trips for each user
    mapping(address => Trip[]) private userTrips;

    function ignitionOn(uint256 startingLat, uint256 startingLon) public {
        Trip memory newTrip;
        newTrip.startTime = block.timestamp;
        newTrip.endTime = 0;
        newTrip.startingLat = startingLat;
        newTrip.startingLon = startingLon;
        newTrip.totalCost = 0;

        // push a new trip and then modify it in place in storage
        userTrips[msg.sender].push();
        Trip storage tripToUpdate = userTrips[msg.sender][
            userTrips[msg.sender].length - 1
        ];

        // assign values to the new trip
        tripToUpdate.startTime = newTrip.startTime;
        tripToUpdate.endTime = newTrip.endTime;
        tripToUpdate.startingLat = newTrip.startingLat;
        tripToUpdate.startingLon = newTrip.startingLon;
        tripToUpdate.totalCost = newTrip.totalCost;
    }

    function ignitionOff(
        uint256[] memory roadIds,
        uint256[] memory startingLats,
        uint256[] memory startingLons,
        uint256[] memory endingLats,
        uint256[] memory endingLons,
        uint256[] memory distances
    ) public payable {
        require(
            roadIds.length == startingLats.length &&
                startingLats.length == startingLons.length &&
                startingLons.length == endingLats.length &&
                endingLats.length == endingLons.length &&
                endingLons.length == distances.length,
            "All path arrays must be of the same length"
        );

        Trip storage currentTrip = userTrips[msg.sender][
            userTrips[msg.sender].length - 1
        ];
        require(currentTrip.startTime != 0, "This trip has not started yet.");
        require(currentTrip.endTime == 0, "This trip is already completed.");
        currentTrip.endTime = block.timestamp;

        uint256 totalCost = 0;
        uint256 refundedAmount = msg.value;

        for (uint256 i = 0; i < roadIds.length; i++) {
            require(
                roadIds[i] > 0 && roadIds[i] <= totalSupply(),
                "Invalid roadId"
            );

            Road storage road = roads[roadIds[i] - 1];

            Path memory newPath = Path({
                roadId: road.id,
                roadName: road.roadName,
                costPerMile: road.costPerMile,
                owner: road.owner,
                startingLat: startingLats[i],
                startingLon: startingLons[i],
                endingLat: endingLats[i],
                endingLon: endingLons[i],
                distance: distances[i]
            });

            currentTrip.paths.push(newPath);

            uint256 cost = (distances[i] * newPath.costPerMile) / 1000;
            totalCost += cost;

            require(refundedAmount >= cost, "Insufficient payment.");
            refundedAmount -= cost;

            // Transfer payment from driver to NFT owner
            (bool success, ) = newPath.owner.call{value: cost}("");
            require(success, "Payment transfer failed.");
        }

        // Refund any overpayment
        if (refundedAmount > 0) {
            (bool success, ) = msg.sender.call{value: refundedAmount}("");
            require(success, "Refund failed.");
        }

        currentTrip.totalCost = totalCost;
    }

    function tripsTakenByDriver(
        address driver
    ) public view returns (TripInfo[] memory tripInfos) {
        Trip[] memory trips = userTrips[driver];
        tripInfos = new TripInfo[](trips.length);

        for (uint256 i = 0; i < trips.length; i++) {
            Trip memory trip = trips[i];
            PathInfo[] memory pathInfos = new PathInfo[](trip.paths.length);

            for (uint256 j = 0; j < trip.paths.length; j++) {
                Path memory path = trip.paths[j];
                pathInfos[j] = PathInfo({
                    roadId: path.roadId,
                    roadName: path.roadName,
                    costPerMile: path.costPerMile,
                    owner: path.owner,
                    startingLat: path.startingLat,
                    startingLon: path.startingLon,
                    endingLat: path.endingLat,
                    endingLon: path.endingLon,
                    distance: path.distance
                });
            }

            tripInfos[i] = TripInfo({
                startTime: trip.startTime,
                endTime: trip.endTime,
                startingLat: trip.startingLat,
                startingLon: trip.startingLon,
                totalCost: trip.totalCost,
                paths: pathInfos
            });
        }
    }

    function getLatestPrice(address priceFeed) public view returns (int) {
        AggregatorV3Interface feed = AggregatorV3Interface(priceFeed);
        (, int price, , , ) = feed.latestRoundData();
        return price;
    }
}
