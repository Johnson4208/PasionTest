import React, {useState} from 'react';

export default function BrandLogo(){
 const [missing,setMissing]=useState(false);
 return missing?<span className="pasion-wordmark">PASION</span>:<img className="pasion-logo-image" src="/pasion-logo.png" alt="PASION" onError={()=>setMissing(true)}/>;
}
