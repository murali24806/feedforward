import { useState, useEffect, useCallback } from 'react';

export const useGeolocation = () => {
  const [location, setLocation] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  const getLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setError('Geolocation is not supported by your browser');
      return;
    }
    setLoading(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        setError(null);
        setLoading(false);
      },
      (err) => {
        setError(err.message);
        setLoading(false);
      },
      { enableHighAccuracy: true, timeout: 50000 }
    );
  }, []);

  const watchLocation = useCallback((callback) => {
    if (!navigator.geolocation) return null;
    const watchId = navigator.geolocation.watchPosition(
      (pos) => callback({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      (err) => console.error('Watch error:', err),
      { enableHighAccuracy: true, timeout: 50000, maximumAge: 5000 }
    );
    return watchId;
  }, []);

  const clearWatch = useCallback((watchId) => {
    if (watchId !== null) navigator.geolocation.clearWatch(watchId);
  }, []);

  return { location, error, loading, getLocation, watchLocation, clearWatch };
};
