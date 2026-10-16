import math, wave, array
from pathlib import Path
rate=44100; duration=20; bpm=108; beat=60/bpm
chords=[(130.8128,164.8138,195.9977,246.9417),(110,130.8128,164.8138,195.9977),(87.3071,110,130.8128,164.8138),(97.9989,123.4708,146.8324,195.9977)]
samples=array.array('h');seed=9231
for i in range(rate*duration):
 t=i/rate; chord=chords[min(3,int(t/5))]; q=t%beat
 # Soft original warm synth bed, rounded pulse and bright, sparse arpeggio.
 pad=sum(math.sin(2*math.pi*f*t+.1*math.sin(t*.9))*.026+math.sin(2*math.pi*f*2*t)*.008 for f in chord)
 kick=math.sin(2*math.pi*(48*q+7*(1-math.exp(-q*35))))*.20*math.exp(-q*19)
 bass=math.sin(2*math.pi*chord[0]/2*t)*.07*(.4+.6*math.exp(-q*7))
 step=int(t/(beat/2)); age=t%(beat/2); note=chord[[0,2,1,3,2,1,3,2][step%8]]*4
 pluck=(math.sin(2*math.pi*note*age)+.22*math.sin(2*math.pi*note*2*age))*.065*math.exp(-age*13)
 seed=(1664525*seed+1013904223)&0xffffffff; noise=seed/2147483648-1
 hat=noise*.022*math.exp(-age*85)
 clapq=(t-beat)%(beat*2); clap=noise*.036*math.exp(-clapq*32)
 fade=min(1,t/.3,(duration-t)/.9)
 v=math.tanh((pad+kick+bass+pluck+hat+clap)*1.25)*fade
 # Gentle stereo width from the pad only.
 side=math.sin(2*math.pi*chord[1]*t)*.009
 samples.extend([int(max(-1,min(1,v+side*fade))*28000),int(max(-1,min(1,v-side*fade))*28000)])
with wave.open(str(Path(__file__).parent/'soundtrack.wav'),'wb') as f:
 f.setnchannels(2);f.setsampwidth(2);f.setframerate(rate);f.writeframes(samples.tobytes())
print('Original 20-second stereo soundtrack rendered.')
