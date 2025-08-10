import React from 'react'
import { SERVER_URL } from '../api'

export default function MatchForm({ onStart }){
  const [universities, setUniversities] = React.useState([])
  const [university, setUniversity] = React.useState("")
  const [interests, setInterests] = React.useState("")
  const [loading, setLoading] = React.useState(true)

  React.useEffect(()=>{
    fetch(`${SERVER_URL}/universities`).then(r=>r.json()).then(setUniversities).finally(()=>setLoading(false))
  },[])

  const submit = (e) => {
    e.preventDefault()
    const ints = interests.split(',').map(s=>s.trim()).filter(Boolean)
    onStart({ university, interests: ints })
  }

  return (
    <form onSubmit={submit} className="row cols-2">
      <div>
        <label>University</label>
        <select value={university} onChange={e=>setUniversity(e.target.value)} required>
          <option value="">Select your university…</option>
          {universities.map(u=> <option key={u} value={u}>{u}</option>)}
        </select>
      </div>
      <div>
        <label>Interests (comma separated)</label>
        <input className="input" placeholder="AI, football, music" value={interests} onChange={e=>setInterests(e.target.value)} />
      </div>
      <div style={{gridColumn:'1 / -1', display:'flex', gap:8}}>
        <button className="btn" disabled={loading}>Find partner</button>
        <span className="small">We do not store chats. Reload leaves the chat.</span>
      </div>
    </form>
  )
}