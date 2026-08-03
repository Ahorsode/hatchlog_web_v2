"use client";

import React from 'react';
import { Button } from '@/components/ui/Button';
import { Settings as SettingsIcon } from 'lucide-react';
import { EditProfileModal } from './EditProfileModal';

interface EditProfileButtonProps {
  initialData: {
    firstname: string;
    middleName?: string;
    surname: string;
  };
}

export function EditProfileButton({ initialData }: EditProfileButtonProps) {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <>
      <Button 
        onClick={() => setIsOpen(true)}
        className="bg-white/10 border border-white/10 hover:bg-white/10 text-white rounded-md h-12 px-5 backdrop-blur-md transition-all group/btn"
      >
        <SettingsIcon className="w-4 h-4 mr-2 group-hover/btn:rotate-90 transition-transform" /> 
        Edit Profile
      </Button>

      <EditProfileModal 
        isOpen={isOpen} 
        onOpenChange={setIsOpen}
        initialData={initialData}
      />
    </>
  );
}
