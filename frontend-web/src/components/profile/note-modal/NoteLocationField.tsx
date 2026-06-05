import { MapPin, X } from "lucide-react";

interface NoteLocationFieldProps {
  location: string;
  onChangeLocation: (value: string) => void;
  onClearLocation: () => void;
}

export default function NoteLocationField({
  location,
  onChangeLocation,
  onClearLocation,
}: NoteLocationFieldProps) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 border dark:border-gray-700 rounded-xl dark:bg-gray-800 focus-within:ring-2 focus-within:ring-blue-500">
      <MapPin className="w-4 h-4 text-gray-400 shrink-0" />
      <input
        type="text"
        value={location}
        onChange={(e) => onChangeLocation(e.target.value)}
        placeholder="Add location..."
        className="flex-1 text-sm bg-transparent dark:text-white focus:outline-none"
      />
      {location && (
        <button
          type="button"
          onClick={onClearLocation}
          className="text-gray-400 hover:text-gray-600"
          title="Clear location"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  );
}
