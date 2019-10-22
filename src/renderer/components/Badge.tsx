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
type Tiny = 'tiny'
export type BadgeSize = Large | Medium | Small | Tiny

export interface Props {
  icon?: string | [string, string]
  hover?: string
  backgroundColor?: string
  shape?: BadgeShape
  size?: BadgeSize
}

export default React.forwardRef((props: Props, ref: React.Ref<HTMLDivElement>) => {
  const { icon, backgroundColor, size = 'large', shape = 'circle', hover } = props
  return (
    <div
      ref={ref}
      className={`Badge Badge--${size} Badge--${shape} ${hover ? 'Badge--hover' : null}`}
      style={{ backgroundColor }}
      data-hover={hover}
    >
      {icon && icon instanceof Array ? (
        <div style={{ fontSize: 'inherit' }} className="fa-stack fa-2x">
          <i className={`fa fa-${icon[0]} fa-stack-2x`} />
          <i className={`fa fa-${icon[1]} fa-stack-1x`} />
        </div>
      ) : (
          <i className={`fa fa-${icon}`} />
        )}
    </div>
  )
})
