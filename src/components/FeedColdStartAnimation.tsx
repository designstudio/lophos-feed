'use client'

import Lottie from 'lottie-react'
import blogAnimation from '@/lib/animations/blog.json'

export default function FeedColdStartAnimation() {
  return <Lottie animationData={blogAnimation} loop autoplay />
}
