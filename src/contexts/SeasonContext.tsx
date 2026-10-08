'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

type SeasonType = { id: string; name: string; start?: string; end?: string; status?: string };

type SeasonContextType = {
  currentSeason: SeasonType | null;
  previousSeason: SeasonType | null;
  setCurrentSeason: (season: SeasonType | null) => void;
};

const SeasonContext = createContext<SeasonContextType>({
  currentSeason: null,
  previousSeason: null,
  setCurrentSeason: () => {},
});

export const SeasonProvider = ({ children }: { children: React.ReactNode }) => {
  const [currentSeason, setCurrentSeasonState] = useState<SeasonType | null>(null);
  const [previousSeason, setPreviousSeason] = useState<SeasonType | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Helper to fetch and set previous season
  const updatePreviousSeason = async (current: SeasonType) => {
    try {
      const { getFirestore, collection, getDocs } = await import('@/firebase/firestore-override');
      const { firebaseConfig } = await import('@/firebase/config');
      const { initializeApp, getApps } = await import('firebase/app');
      let app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
      const db = getFirestore(app);
      
      const seasonsRef = collection(db, 'seasons');
      const snapshot = await getDocs(seasonsRef);
      
      let allSeasons: SeasonType[] = [];
      snapshot.forEach(doc => {
        const data = doc.data();
        allSeasons.push({
          id: doc.id,
          name: data.name || '',
          start: data.start_date || undefined,
          end: data.end_date || undefined,
          status: data.status || 'Active'
        });
      });
      
      // Sort by start_date ascending
      allSeasons.sort((a, b) => {
        if (!a.start && !b.start) return 0;
        if (!a.start) return 1;
        if (!b.start) return -1;
        return a.start.localeCompare(b.start);
      });
      
      const currentIndex = allSeasons.findIndex(s => s.id === current.id);
      if (currentIndex > 0) {
        const prev = allSeasons[currentIndex - 1];
        setPreviousSeason(prev);
        localStorage.setItem('prev_season_id', prev.id);
      } else {
        setPreviousSeason(null);
        localStorage.removeItem('prev_season_id');
      }
    } catch (e) {
      console.error('Failed to calculate previous season:', e);
    }
  };

  useEffect(() => {
    const loadInitialSeason = async () => {
      try {
        const storedId = localStorage.getItem('season_id');
        const storedName = localStorage.getItem('season_name');
        const storedStart = localStorage.getItem('season_start');
        const storedEnd = localStorage.getItem('season_end');
        const storedStatus = localStorage.getItem('season_status');

        if (storedId && storedName) {
          const current = {
            id: storedId,
            name: storedName,
            start: storedStart || undefined,
            end: storedEnd || undefined,
            status: storedStatus || undefined
          };
          setCurrentSeasonState(current);
          setIsLoaded(true);
          updatePreviousSeason(current);
        } else {
          // If no season in local storage, fetch default season from Firestore
          const { getFirestore, collection, query, where, getDocs } = await import('@/firebase/firestore-override');
          const { firebaseConfig } = await import('@/firebase/config');
          const { initializeApp, getApps } = await import('firebase/app');
          
          let app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
          const db = getFirestore(app);
          
          const seasonsRef = collection(db, 'seasons');
          const defaultQuery = query(seasonsRef, where('isDefault', '==', true));
          let snapshot = await getDocs(defaultQuery);
          
          if (snapshot.empty) {
            // Fallback to Active if isDefault doesn't exist yet
            const activeQuery = query(seasonsRef, where('status', '==', 'Active'));
            snapshot = await getDocs(activeQuery);
          }
          
          if (!snapshot.empty) {
            const defaultDoc = snapshot.docs[0];
            const data = defaultDoc.data();
            const defaultSeason = {
              id: defaultDoc.id,
              name: data.name || '',
              start: data.start_date || undefined,
              end: data.end_date || undefined,
              status: data.status || 'Active'
            };
            
            setCurrentSeasonState(defaultSeason);
            localStorage.setItem('season_id', defaultSeason.id);
            localStorage.setItem('season_name', defaultSeason.name);
            if (defaultSeason.start) localStorage.setItem('season_start', defaultSeason.start);
            if (defaultSeason.end) localStorage.setItem('season_end', defaultSeason.end);
            if (defaultSeason.status) localStorage.setItem('season_status', defaultSeason.status);
            updatePreviousSeason(defaultSeason);
          }
          setIsLoaded(true);
        }
      } catch (error) {
        console.error('Failed to read or fetch default season:', error);
        setIsLoaded(true);
      }
    };

    loadInitialSeason();
  }, []);

  const setCurrentSeason = (season: SeasonType | null) => {
    setCurrentSeasonState(season);
    
    try {
      if (season) {
        localStorage.setItem('season_id', season.id);
        localStorage.setItem('season_name', season.name);
        if (season.start) localStorage.setItem('season_start', season.start);
        if (season.end) localStorage.setItem('season_end', season.end);
        if (season.status) localStorage.setItem('season_status', season.status);
        updatePreviousSeason(season);
      } else {
        localStorage.removeItem('season_id');
        localStorage.removeItem('season_name');
        localStorage.removeItem('season_start');
        localStorage.removeItem('season_end');
        localStorage.removeItem('season_status');
        setPreviousSeason(null);
        localStorage.removeItem('prev_season_id');
      }
      
      if (isLoaded) {
        window.location.reload();
      }
    } catch (error) {
      console.error('Failed to write season to localStorage:', error);
    }
  };



  return (
    <SeasonContext.Provider value={{ currentSeason, previousSeason, setCurrentSeason }}>
      {children}
    </SeasonContext.Provider>
  );
};

export const useSeason = () => useContext(SeasonContext);
