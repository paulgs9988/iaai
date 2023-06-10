# Via Dappia

This application is stylistically named after the first major road in Rome. This application has a smart contract that is used to mint NFTs that represent ownership of a piece of a road. These road pieces are defined by the NFT's metadata. The application also has a front end application that is interacting with the smart contract. When the user connects to the application, the application queries the smart contract for all of the information associated with the road pieces. When the user selects the role of a driver by clicking the "I am a driver" button, her location begins to be tracked. If she drives on one of these road pieces, her path on the road piece will be recorded and it will trigger the smart contract to make a payment to the owner of that road piece based on how far the user has driven on that road piece. Currently there are only 4 road pieces in Salt Lake City, USA that have been minted for demo purposes, but I would love to give others an opportunity to try it and email me at paul.sullivan.g@gmail.com so I can mint some roads near you and you can try it!

## Features

- **Smart Contract Integration**: The application interacts with a smart contract on Ethereum's Sepolia Testnet, allowing secure and reliable financial interaction between drivers and road owners. Also makes automated payment seameless.
- **Useful Road Metadata Structure**: - Each road has associated metadata like cost, geographical coordinates, and name
- **User Data Creation**: Track and retrieve road trips taken by any address.
- **Chainlink**: Uses chainlink to easily facilitate mult-currency cost calculation

## Getting Started

These instructions will get you a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

- [Node.js and npm](https://nodejs.org/en/download/)
- [Git](https://git-scm.com/downloads)

### Installation and Setup

1. Clone the repository:
   ```sh
   git clone https://github.com/paulgs9988/iaai.git
   ```

````
2. Navigate to the project directory:
```sh
cd iaai-app
````

3. Install the dependencies:

```sh
npm install
```

4. Start the development severe:

```sh
npm start
```

Visit http://localhost:3000 in your browser to view the application.

### Using the application

See the "Via Dappia" section above for an explanation of how the application works. If you'd like to test it out, contact me to have some roads in your area minted as owned road pieces. Then you can launch the application, enable your location services, and drive on those road pieces and see payments go to the owner of those NFTs.

### Contributing

If you would like to contribute, please fork the project and use a feature branch. Pull requests are warmly welcome.

### Links

Related Projects:

### Licensing

“The code in this project is licensed under MIT license.”

### Authors

-Paul Sullivan paulgs9988@gmail.com
