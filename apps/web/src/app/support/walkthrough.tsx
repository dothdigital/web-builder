import { videos } from './videos'
import transcripts from './video-transcripts.json'
import styles from './support.module.css'
export function Walkthrough({ id }: { id: string }) {
 const video=videos.find(v=>v.id===id)
 if(!video)return null
 const transcript=(transcripts.videos as {id:string;captions:string[]}[]).find(v=>v.id===id)
 return <section className={styles.walkthrough} aria-label={`Video: ${video.title}`}><div className={styles.videoHeading}><div><p className={styles.eyebrow}>WATCH & FOLLOW ALONG</p><h2>{video.title}</h2></div><span>Captioned · No audio</span></div>
  <video className={styles.video} controls preload="none" playsInline poster={`/support/${video.poster}.webp`} aria-label={video.title}>
   <source src={`/support/videos/${video.id}.webm`} type="video/webm"/>
   <track kind="captions" src={`/support/videos/${video.id}.vtt`} srcLang="en" label="English"/>
   Your browser cannot play this video. Use the download link below or follow the illustrated steps.
  </video>
  <div className={styles.videoFoot}><p>Recorded in the fictional Willow Studio website using a normal customer account. AI submission steps are explained without running a generation job.</p><a href={`/support/videos/${video.id}.webm`} download>Download video ↓</a></div>
  {transcript && <details className={styles.transcript}><summary>Read the video transcript</summary><ol>{transcript.captions.map((text,i)=><li key={i}>{text}</li>)}</ol></details>}
 </section>
}
