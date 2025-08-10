import React, { useMemo } from 'react'
import { io } from 'socket.io-client'
import Home from './pages/Home.jsx'
import Chat from './pages/Chat.jsx'

export default function App(){
  const [view, setView] = React.useState('home')
  const [socket, setSocket] = React.useState(null)
  const [session, setSession] = React.useState({ roomId:null, partner:null, you:null })

  const connect = React.useCallback(()=>{
    const s = io(import.meta.env.VITE_SERVER_URL || 'http://localhost:5000', { transports:['websocket'] })
    setSocket(s)
    return s
  },[])

  const startChat = (profile) => {
    const s = socket || connect()
    s.on('connect', ()=>{
      s.emit('find_partner', profile)
    })
    s.on('queued', ()=>{})
    s.on('match_found', (data)=>{
      setSession(data)
      setView('chat')
    })
    s.on('match_error', (e)=> alert(e?.message || 'Error'))
  }

  const leave = () => {
    if (socket) socket.disconnect()
    setSession({ roomId:null, partner:null, you:null })
    setSocket(null)
    setView('home')
  }

  return view === 'home' ? (
    <Home onStart={startChat} />
  ) : (
    <Chat socket={socket} session={session} onLeave={leave} />
  )
}