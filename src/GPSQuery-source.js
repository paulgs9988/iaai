(async () => {
  const axios = require("axios");
  const API_KEY = `${process.env.API_KEY}`;
  const API_URL = "https://api.mapbox.com/geocoding/v5/mapbox.places";
  const [latitude, longitude] = ARGS;

  const response = await axios.get(
    `${API_URL}?latitude=${latitude}&longitude=${longitude}&apiKey=${API_KEY}`
  );
  return response.data;
})();
