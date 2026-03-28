import { useEffect, useState } from 'react';
import { Card, Input, Badge, EmptyState, PageLoader } from '@/components/ui';
import { supabase } from '@/lib/supabase';
import { Search, Building2, DoorOpen, MapPin, User } from 'lucide-react';
import type { Property, Owner } from '@/types/database';

interface PropertyWithDetails extends Property {
  owner: Pick<Owner, 'name' | 'phone'>;
  rooms_count: number;
  occupied_count: number;
}

export function AllPropertiesPage() {
  const [properties, setProperties] = useState<PropertyWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    fetchProperties();
  }, []);

  const fetchProperties = async () => {
    try {
      const { data, error } = await supabase
        .from('properties')
        .select(`
          *,
          owner:owners(name, phone),
          rooms:rooms(count),
          occupied_rooms:rooms(count)
        `)
        .eq('occupied_rooms.is_occupied', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      const propertiesWithDetails = data?.map((prop) => ({
        ...prop,
        owner: prop.owner,
        rooms_count: prop.rooms?.[0]?.count || 0,
        occupied_count: prop.occupied_rooms?.[0]?.count || 0,
      })) || [];

      setProperties(propertiesWithDetails);
    } catch (error) {
      console.error('Error fetching properties:', error);
    } finally {
      setLoading(false);
    }
  };

  const filteredProperties = properties.filter(
    (prop) =>
      prop.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prop.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
      prop.owner?.name?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (loading) return <PageLoader />;

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
        <Input
          placeholder="Search properties or owners..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {filteredProperties.length === 0 ? (
        <EmptyState
          icon={<Building2 className="h-12 w-12" />}
          title="No properties found"
          description="Properties added by owners will appear here"
        />
      ) : (
        <div className="space-y-3">
          {filteredProperties.map((property) => (
            <Card key={property.id} className="p-4">
              <div className="flex items-start gap-3">
                <div className="p-2 bg-primary-50 rounded-lg">
                  <Building2 className="h-5 w-5 text-primary-600" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{property.name}</h3>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-0.5">
                    <MapPin className="h-3 w-3" />
                    {property.address}, {property.city}
                  </div>
                  <div className="flex items-center gap-1 text-sm text-gray-500 mt-1">
                    <User className="h-3 w-3" />
                    {property.owner?.name} ({property.owner?.phone})
                  </div>
                  <div className="flex items-center gap-3 mt-2">
                    <Badge variant="info">
                      <DoorOpen className="h-3 w-3 mr-1" />
                      {property.rooms_count} rooms
                    </Badge>
                    <Badge variant="success">
                      {property.occupied_count} occupied
                    </Badge>
                    <Badge variant="warning">
                      {property.rooms_count - property.occupied_count} vacant
                    </Badge>
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
