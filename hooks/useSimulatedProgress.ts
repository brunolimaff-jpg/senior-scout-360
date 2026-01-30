
import { useState, useEffect, useRef } from 'react';

interface ProgressState {
  progress: number;
  timeLeft: number; // seconds
}

export function useSimulatedProgress(
  isActive: boolean, 
  durationSeconds: number = 15
): ProgressState {
  const [state, setState] = useState<ProgressState>({ progress: 0, timeLeft: durationSeconds });
  const intervalRef = useRef<any>(null);

  useEffect(() => {
    if (isActive) {
      // Reset state on start
      setState({ progress: 0, timeLeft: durationSeconds });
      
      const startTime = Date.now();
      const targetDuration = durationSeconds * 1000;

      intervalRef.current = setInterval(() => {
        const elapsed = Date.now() - startTime;
        let newProgress = 0;

        if (elapsed < targetDuration) {
          // Fase 1: Progresso normal assintótico até 90%
          // Curva mais suave para não correr demais no início
          const ratio = elapsed / targetDuration;
          newProgress = Math.min(ratio * 90, 90);
          
          // Adiciona jitter (pequena variação) para parecer orgânico
          if (newProgress > 10 && newProgress < 80) {
             newProgress += (Math.random() - 0.5) * 0.2;
          }
        } else {
          // Fase 2: Overtime (Passou do tempo estimado)
          // Avança MUITO lentamente de 90% até 99%
          // Isso evita a sensação de travamento total
          const extraTime = elapsed - targetDuration;
          const overtimeRatio = 1 - Math.exp(-extraTime / 20000); // Avança devagar pelos próximos 20s
          newProgress = 90 + (overtimeRatio * 9);
        }

        const newTimeLeft = Math.max(0, Math.ceil(durationSeconds - (elapsed / 1000)));

        setState({ 
          progress: Math.min(newProgress, 99.5), // Teto de 99.5%
          timeLeft: newTimeLeft 
        });

      }, 200);
    } else {
      // Quando termina (isActive = false), limpa tudo
      if (intervalRef.current) clearInterval(intervalRef.current);
      setState({ progress: 0, timeLeft: durationSeconds });
    }

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isActive, durationSeconds]);

  return state;
}
