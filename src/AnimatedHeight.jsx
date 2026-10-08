import React, {useLayoutEffect, useRef, useState} from 'react';

export default function AnimatedHeight({view, children}) {
 const content = useRef(null);
 const [height, setHeight] = useState(null);

 useLayoutEffect(() => {
  const element = content.current;
  const measure = () => setHeight(element.offsetHeight);
  measure();
  const observer = new ResizeObserver(measure);
  observer.observe(element);
  const animation = window.matchMedia('(prefers-reduced-motion: reduce)').matches ? null : element.animate(
   [{opacity: 0, transform: 'translateY(8px)'}, {opacity: 1, transform: 'translateY(0)'}],
   {duration: 380, easing: 'cubic-bezier(.22, 1, .36, 1)'}
  );
  return () => {observer.disconnect();animation?.cancel();};
 }, [view]);

 return <div className="animated-height" style={{height: height === null ? 'auto' : height}}>
  <div className="animated-view" ref={content}>{children}</div>
 </div>;
}
