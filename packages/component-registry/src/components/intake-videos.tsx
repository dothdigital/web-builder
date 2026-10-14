import React from 'react'
import { z } from 'zod'
import { videoLinkSchema, videoSource } from '@awb/shared/intake-media'
import { defineComponent } from '../types'
import { Container, Heading, Section } from '../primitives'

export const intakeVideos = defineComponent({
  componentId: 'IntakeVideos', version: '1.0.0', family: 'GALLERY', name: 'Business videos',
  description: 'Videos supplied by the business during setup.',
  aiGuidance: 'Only include videos explicitly supplied by the business; never invent video links.',
  propsSchema: z.object({ heading: z.string().default('Our videos'), videos: z.array(z.object({ url: videoLinkSchema, title: z.string().min(1).max(120) })).max(5) }),
  editorFields: [{ path: '/heading', label: 'Heading', type: 'text', headingLevel: 2 }, { path: '/videos', label: 'Video links and titles', type: 'list' }],
  tokenDeps: [], fixture: { heading: 'Our videos', videos: [] },
  render: ({ props }) => <Section><Container><Heading level={2}>{props.heading}</Heading>
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 320px), 1fr))', gap: '2rem' }}>
      {props.videos.map((video, index) => {
        const source = videoSource(video.url)
        if (!source) return null
        return <figure key={index} style={{ margin: 0 }}>
          {source.kind === 'file' ? <video src={source.url} controls playsInline preload="metadata" aria-label={video.title} style={{ width: '100%', aspectRatio: '16 / 9' }} /> : <iframe src={source.url} title={video.title} loading="lazy" allow="fullscreen; picture-in-picture" allowFullScreen referrerPolicy="strict-origin-when-cross-origin" style={{ width: '100%', aspectRatio: '16 / 9', border: 0 }} />}
          <figcaption>{video.title}</figcaption>
        </figure>
      })}
    </div>
  </Container></Section>,
})
