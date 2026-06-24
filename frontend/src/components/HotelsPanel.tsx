import React, { useEffect, useState } from 'react';
import { hotelsAPI } from '../utils/api-service';
import { Spinner, Badge } from './common';
import './HotelsPanel.css';

interface Hotel {
  id: string;
  name: string;
  city: string;
  location?: string;
  contact_phone?: string;
  contact_email?: string;
  description?: string;
  rating?: number;
  room_type_count?: number;
}

interface RoomType {
  id: string;
  name: string;
  description?: string;
  capacity: number;
  amenities?: string[];
  pricing: any[];
}

interface HotelDetail extends Hotel {
  room_types: RoomType[];
}

export const HotelsPanel: React.FC = () => {
  const [hotels, setHotels] = useState<HotelDetail[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedCity, setSelectedCity] = useState<string | null>(null);
  const [cities, setCities] = useState<string[]>([]);
  const [expandedHotels, setExpandedHotels] = useState<Set<string>>(new Set());
  const [stats, setStats] = useState<any>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchHotels();
  }, []);

  const fetchHotels = async () => {
    try {
      setLoading(true);
      const [citiesRes, hotelStatsRes] = await Promise.all([
        hotelsAPI.getCities(),
        hotelsAPI.getStats()
      ]);

      if (citiesRes.data.success) {
        setCities(citiesRes.data.data);
        if (citiesRes.data.data.length > 0) {
          setSelectedCity(citiesRes.data.data[0]);
        }
      }

      if (hotelStatsRes.data.success) {
        setStats(hotelStatsRes.data.data);
      }

      await loadHotelsForCity(citiesRes.data.data[0] || null);
    } catch (err) {
      setError('Failed to load hotels data');
      console.error('Error fetching hotels:', err);
    } finally {
      setLoading(false);
    }
  };

  const loadHotelsForCity = async (city: string | null) => {
    try {
      setLoading(true);
      const response = city
        ? await hotelsAPI.getByCity(city)
        : await hotelsAPI.getAll();

      if (response.data.success) {
        // Fetch detailed info for each hotel
        const detailedHotels = await Promise.all(
          response.data.data.map(async (hotel: Hotel) => {
            try {
              const detail = await hotelsAPI.getDetails(hotel.id);
              return detail.data.success ? detail.data.data : hotel;
            } catch {
              return hotel;
            }
          })
        );
        setHotels(detailedHotels);
      }
    } catch (err) {
      setError('Failed to load hotels');
      console.error('Error loading hotels:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCityChange = (city: string) => {
    setSelectedCity(city);
    loadHotelsForCity(city);
  };

  const toggleHotelExpand = (hotelId: string) => {
    const newExpanded = new Set(expandedHotels);
    if (newExpanded.has(hotelId)) {
      newExpanded.delete(hotelId);
    } else {
      newExpanded.add(hotelId);
    }
    setExpandedHotels(newExpanded);
  };

  const formatPrice = (price: number | undefined) => {
    if (!price) return 'N/A';
    return `PKR ${price.toLocaleString()}`;
  };

  const renderPricing = (pricing: any[]) => {
    if (!pricing || pricing.length === 0) {
      return <span className="text-gray-500 text-sm">No pricing available</span>;
    }

    // Group pricing by season
    const byOccupancy = pricing.filter(p => p.occupancy_type);
    const bySeason = pricing.filter(p => p.season_name);
    const fixed = pricing.filter(p => !p.occupancy_type && !p.season_name);

    return (
      <div className="space-y-2">
        {fixed.map((p) => (
          <div key={p.id} className="flex justify-between text-sm">
            <span>Fixed Price:</span>
            <span className="font-medium">{formatPrice(p.price_pkr)}</span>
          </div>
        ))}

        {byOccupancy.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Occupancy-Based Prices:</p>
            {byOccupancy.map((p) => (
              <div key={p.id} className="ml-2 flex justify-between text-sm">
                <span className="capitalize">• {p.occupancy_type}:</span>
                <span className="font-medium">{formatPrice(p.price_pkr)}</span>
              </div>
            ))}
          </div>
        )}

        {bySeason.length > 0 && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400 mb-1">Seasonal Prices:</p>
            {bySeason.map((p) => (
              <div key={p.id} className="ml-2 flex justify-between text-sm">
                <span className="capitalize">
                  {p.season_name}
                  {p.price_range_min && p.price_range_max ? ':' : ':'}
                </span>
                <span className="font-medium">
                  {p.price_range_min && p.price_range_max
                    ? `PKR ${p.price_range_min.toLocaleString()} - ${p.price_range_max.toLocaleString()}`
                    : formatPrice(p.price_pkr)}
                </span>
              </div>
            ))}
          </div>
        )}

        {pricing.some(p => p.extra_services) && (
          <div className="mt-2">
            <p className="text-xs font-semibold text-gray-600 dark:text-gray-400">Extra Services:</p>
            {pricing.map((p) => {
              const extras = p.extra_services;
              if (!extras) return null;
              return Object.entries(extras).map(([service, price]: [string, any]) => (
                <div key={`${p.id}-${service}`} className="ml-2 flex justify-between text-sm text-gray-600 dark:text-gray-400">
                  <span className="capitalize">• {service}:</span>
                  <span>PKR {price.toLocaleString()}</span>
                </div>
              ));
            })}
          </div>
        )}
      </div>
    );
  };

  const filteredHotels = hotels.filter(hotel =>
    hotel.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    hotel.city.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading && hotels.length === 0) {
    return (
      <div className="flex items-center justify-center p-8">
        <Spinner size="lg" />
      </div>
    );
  }

  return (
    <div className="hotels-panel p-6 bg-white dark:bg-slate-900 rounded-lg space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">
          🏨 Hotel Directory
        </h2>
        <p className="text-gray-600 dark:text-gray-400">
          Complete list of hotels with room types and pricing
        </p>
      </div>

      {/* Statistics */}
      {stats && (
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/30 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Total Hotels</p>
            <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">{stats.total_hotels}</p>
          </div>
          <div className="bg-green-50 dark:bg-green-900/30 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Cities</p>
            <p className="text-2xl font-bold text-green-600 dark:text-green-400">{stats.total_cities}</p>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/30 p-4 rounded-lg">
            <p className="text-sm text-gray-600 dark:text-gray-400">Room Types</p>
            <p className="text-2xl font-bold text-purple-600 dark:text-purple-400">{stats.total_room_types}</p>
          </div>
        </div>
      )}

      {/* City Filter */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3">
          Filter by City
        </label>
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleCityChange('')}
            className={`px-4 py-2 rounded-lg font-medium transition ${
              !selectedCity
                ? 'bg-blue-600 text-white'
                : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
            }`}
          >
            All Cities
          </button>
          {cities.map(city => (
            <button
              key={city}
              onClick={() => handleCityChange(city)}
              className={`px-4 py-2 rounded-lg font-medium transition ${
                selectedCity === city
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
              }`}
            >
              {city}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      <div>
        <input
          type="text"
          placeholder="Search hotels by name or location..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-400 p-4 rounded-lg">
          {error}
        </div>
      )}

      {/* Hotels List */}
      <div className="space-y-4">
        {filteredHotels.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-gray-500 dark:text-gray-400">
              {searchQuery ? 'No hotels found matching your search' : 'No hotels available'}
            </p>
          </div>
        ) : (
          filteredHotels.map(hotel => (
            <div
              key={hotel.id}
              className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden hover:shadow-lg transition"
            >
              {/* Hotel Header */}
              <button
                onClick={() => toggleHotelExpand(hotel.id)}
                className="w-full p-4 bg-gradient-to-r from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-750 hover:from-gray-100 hover:to-gray-150 dark:hover:from-gray-700 dark:hover:to-gray-800 flex items-center justify-between transition"
              >
                <div className="text-left flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-white">
                    {hotel.name}
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400">
                      {hotel.city}
                    </span>
                    {hotel.location && (
                      <span className="text-sm text-gray-600 dark:text-gray-400">{hotel.location}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {hotel.room_types && hotel.room_types.length > 0 && (
                    <span className="text-sm font-medium bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-3 py-1 rounded-full">
                      {hotel.room_types.length} rooms
                    </span>
                  )}
                  <span className={`transition-transform ${expandedHotels.has(hotel.id) ? 'rotate-180' : ''}`}>
                    ▼
                  </span>
                </div>
              </button>

              {/* Expanded Content */}
              {expandedHotels.has(hotel.id) && (
                <div className="p-4 bg-white dark:bg-slate-850 border-t border-gray-200 dark:border-gray-700">
                  {/* Hotel Details */}
                  {(hotel.contact_phone || hotel.contact_email || hotel.rating) && (
                    <div className="mb-4 pb-4 border-b border-gray-200 dark:border-gray-700">
                      <div className="grid grid-cols-2 gap-4">
                        {hotel.rating && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Rating</p>
                            <p className="font-semibold text-gray-900 dark:text-white">⭐ {hotel.rating} / 5</p>
                          </div>
                        )}
                        {hotel.contact_phone && (
                          <div>
                            <p className="text-xs text-gray-500 dark:text-gray-400">Phone</p>
                            <p className="font-semibold text-gray-900 dark:text-white">{hotel.contact_phone}</p>
                          </div>
                        )}
                      </div>
                      {hotel.contact_email && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 dark:text-gray-400">Email</p>
                          <p className="font-semibold text-gray-900 dark:text-white break-all">{hotel.contact_email}</p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Room Types */}
                  {hotel.room_types && hotel.room_types.length > 0 ? (
                    <div className="space-y-4">
                      {hotel.room_types.map(roomType => (
                        <div
                          key={roomType.id}
                          className="bg-gray-50 dark:bg-gray-800/50 p-4 rounded-lg"
                        >
                          <div className="flex items-start justify-between mb-2">
                            <div>
                              <h4 className="font-bold text-gray-900 dark:text-white">
                                {roomType.name}
                              </h4>
                              {roomType.description && (
                                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                                  {roomType.description}
                                </p>
                              )}
                            </div>
                            {roomType.capacity && (
                              <span className="inline-block px-3 py-1 rounded-full text-sm font-medium bg-gray-200 dark:bg-gray-700 text-gray-800 dark:text-gray-300">
                                👥 {roomType.capacity} {roomType.capacity === 1 ? 'person' : 'persons'}
                              </span>
                            )}
                          </div>

                          {roomType.amenities && roomType.amenities.length > 0 && (
                            <div className="my-2 flex flex-wrap gap-1">
                              {roomType.amenities.map((amenity, idx) => (
                                <span
                                  key={idx}
                                  className="text-xs bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 px-2 py-1 rounded"
                                >
                                  {amenity}
                                </span>
                              ))}
                            </div>
                          )}

                          <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
                            {renderPricing(roomType.pricing)}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-500 dark:text-gray-400">No room types available</p>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
