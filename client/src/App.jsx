import React from 'react'
import { io } from 'socket.io-client'
import Home from './pages/Home.jsx'
import Chat from './pages/Chat.jsx'

export default function App(){
  const [view, setView] = React.useState('home')
  const [socket, setSocket] = React.useState(null)
  const [session, setSession] = React.useState({ roomId:null, partner:null, you:null, commonInterests:[] })
  const [queued, setQueued] = React.useState(false)
  const [lastProfile, setLastProfile] = React.useState(null)

  const connect = React.useCallback(()=>{
    const s = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:5000', { transports:['websocket'] })
    setSocket(s)
    return s
  },[])

  const startChat = (profile) => {
    setLastProfile(profile)
    const s = socket || connect()

    s.off('queued'); s.off('match_found'); s.off('match_error')
    s.on('connect', ()=> s.emit('find_partner', profile))
    s.on('queued', ()=> setQueued(true))
    s.on('match_found', (data)=> { setQueued(false); setSession(data); setView('chat') })
    s.on('match_error', (e)=> { setQueued(false); alert(e?.message || 'Error') })
  }

  const requeue = () => {
    if (!socket) return
    setQueued(true)
    socket.emit('requeue')
  }

  const leaveToHome = () => {
    setView('home')
    setSession({ roomId:null, partner:null, you:null, commonInterests:[] })
    setQueued(false)
    // keep socket connected; it’s fine
  }

  return view === 'home' ? (
    <Home onStart={startChat} queued={queued} />
  ) : (
    <Chat
      socket={socket}
      session={session}
      onLeaveHard={leaveToHome}
      onRequeue={requeue}
      setQueued={setQueued}
      setSession={setSession}
    />
  )
}
