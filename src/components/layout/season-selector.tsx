'use client';

import React, { useEffect, useState } from 'react';
import { useSeason } from '@/contexts/SeasonContext';
import { collection, query, getDocs } from '@/firebase/firestore-override';
import { useFirestore } from '@/firebase';

export function SeasonSelector() {
  const { currentSeason, setCurrentSeason } = useSeason();
  const db = useFirestore();
  const [seasons, setSeasons] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!db) return;
    const fetchSeasons = async () => {
      try {
        const q = query(collection(db, 'seasons'));
        const snap = await getDocs(q);
        const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        
        // Sort seasons by start date descending or simply leave as is
        setSeasons(data);
      } catch (err) {
        console.error('Failed to fetch seasons for selector:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchSeasons();
  }, [db]);

  if (loading || !currentSeason) {
    return (
      <div className="h-9 w-48 bg-slate-100 animate-pulse rounded-md mr-4" />
    );
  }

  return (
    <select
      className="h-9 w-56 px-3 py-1 bg-white border border-slate-200 rounded-md text-xs font-semibold text-slate-700 outline-none focus:ring-2 focus:ring-[#193A7B]/20 focus:border-[#193A7B] transition-all mr-4 cursor-pointer"
      value={currentSeason?.id || ''}
      onChange={(e) => {
        const selected = seasons.find(s => s.id === e.target.value);
        if (selected) {
          setCurrentSeason({
            id: selected.id,
            name: selected.name,
            start: selected.start,
            end: selected.end,
            status: selected.status
          });
        }
      }}
    >
      {seasons.map((season) => (
        <option key={season.id} value={season.id}>
          {season.name}
        </option>
      ))}
    </select>
  );
}
