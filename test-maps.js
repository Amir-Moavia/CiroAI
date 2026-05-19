const fetch = require('node-fetch'); // wait, standard Node has fetch natively in v18+
async function run() {
  const key = 'AIzaSyDGgqOq_rPFaZAJdGkJ9-ksHs_ndY7TJdo';
  const url = `https://maps.googleapis.com/maps/api/geocode/json?address=Islamabad,Pakistan&key=${key}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log('GEOCODE RESPONSE:', JSON.stringify(data, null, 2));
    
    const dirUrl = `https://maps.googleapis.com/maps/api/directions/json?origin=33.6844,73.0479&destination=33.6944,73.0579&mode=driving&key=${key}`;
    const res2 = await fetch(dirUrl);
    const data2 = await res2.json();
    console.log('DIRECTIONS RESPONSE:', JSON.stringify(data2, null, 2));
  } catch (e) {
    console.error('ERROR:', e.message);
  }
}
run();
