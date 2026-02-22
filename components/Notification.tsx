
import React, { useEffect, useState } from 'react';
import { Notification as NotificationType } from '../types';

interface NotificationProps {
  notification: NotificationType | null;
  onClose: () => void;
}

const Notification: React.FC<NotificationProps> = ({ notification, onClose }) => {
  const [isExiting, setIsExiting] = useState(false);

  useEffect(() => {
    if (notification) {
      setIsExiting(false);
      const timer = setTimeout(() => {
        setIsExiting(true);
      }, 3500); // Start exit animation before removal

      return () => clearTimeout(timer);
    }
  }, [notification]);

  if (!notification) {
    return null;
  }
  
  const baseClasses = "flex items-center justify-between w-full max-w-md p-4 rounded-lg shadow-2xl text-white";
  const typeClasses = {
    success: 'bg-green-500',
    error: 'bg-red-500',
    info: 'bg-blue-500',
  };

  const animationClass = isExiting ? 'notification-exit' : 'notification-enter';

  return (
    <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[3000] w-full px-4 flex justify-center">
       <div 
          className={`${baseClasses} ${typeClasses[notification.type]} ${animationClass}`}
          role="status"
          aria-live="polite"
       >
         <p className="font-semibold">{notification.message}</p>
         <button onClick={onClose} className="ml-4 p-1 rounded-full hover:bg-white/20" aria-label="Fermer la notification">
             &times;
         </button>
       </div>
    </div>
  );
};

export default Notification;
