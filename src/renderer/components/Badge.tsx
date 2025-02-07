import React from 'react'
import './Badge.css'

// The `icon` prop should be the class name of the font awesome icon without the "fa-" prefix
// e.g. For the icon "fa-files-o" pass "files-o".
type Circle = 'circle'
type Square = 'square'
export type BadgeShape = Circle | Square

type Large = 'large'
type Medium = 'medium'
type Small = 'small'
export type BadgeSize = Large | Medium | Small

export interface Props {
  icon: string
  backgroundColor?: string
  shape?: BadgeShape
  size?: BadgeSize
}

export default React.forwardRef((props: Props, ref: React.Ref<HTMLDivElement>) => {
  const { icon, backgroundColor, size = 'large', shape = 'circle' } = props
  return (
    <div ref={ref} className={`Badge Badge--${size} Badge--${shape}`} style={{ backgroundColor }}>
      <i className={`fa fa-${icon}`} />
    </div>
  )
})
