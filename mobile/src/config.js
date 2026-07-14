import Constants from 'expo-constants';

// Dynamically resolve the Metro bundler IP address during local development
// This ensures it works seamlessly on any machine (like the recruiter's) without hardcoding!
const getHostIp = () => {
  const hostUri = Constants.expoConfig?.hostUri;
  if (hostUri) {
    return hostUri.split(':')[0]; // Extract just the IP address
  }
  return 'localhost'; // Fallback
};

const HOST_IP = getHostIp();

const CONFIG = {
  API_BASE_URL: `http://${HOST_IP}:3000`,
};

export default CONFIG;
