import React from 'react'
import Header from '../components/Header.jsx'
import MessageBubble from '../components/MessageBubble.jsx'

export default function Chat({ socket, session, onLeave }){
  const [messages, setMessages] = React.useState([])
  const [text, setText] = React.useState("")
  const [typing, setTyping] = React.useState(false)

  React.useEffect(()=>{
    if (!socket) return
    const onMessage = (m)=> setMessages(prev=> [...prev, m])
    const onTyping = ({ from, state }) => setTyping(state)
    socket.on('message', onMessage)
    socket.on('typing', onTyping)
    return ()=>{
      socket.off('message', onMessage)
      socket.off('typing', onTyping)
    }
  }, [socket])

  const send = (e) => {
    e.preventDefault()
    if (!text.trim()) return
    socket.emit('send_message', { roomId: session.roomId, text })
    setMessages(prev=> [...prev, { from: socket.id, text, ts: Date.now() }])
    setText("")
  }

  const onTypingChange = (e) => {
    setText(e.target.value)
    socket.emit('typing', { roomId: session.roomId, state: true })
    setTimeout(()=> socket.emit('typing', { roomId: session.roomId, state: false }), 900)
  }

  return (
    <div className="container">
      <Header />

      <div className="card" style={{marginTop:16}}>
        <div style={{display:'flex', justifyContent:'space-between', alignItems:'center'}}>
          <div>
            <div className="small">Connected to: <strong>{session?.partner?.university || 'Unknown'}</strong></div>
            <div className="small">You: {session?.you?.university}</div>
          </div>
          <div style={{display:'flex', gap:8}}>
            <button className="btn" onClick={()=> socket.emit('skip')}>Skip</button>
            <button className="btn" onClick={onLeave}>Leave</button>
          </div>
        </div>

        <div className="chat" style={{marginTop:12}}>
          <div className="messages">
            {messages.map((m, i)=> (
              <MessageBubble key={i} me={m.from === socket.id} text={m.text} />
            ))}
          </div>
          {typing && <div className="small">Partner is typing…</div>}
          <form className="footer" onSubmit={send}>
            <input className="input" placeholder="Type a message…" value={text} onChange={onTypingChange} />
            <button className="btn">Send</button>
          </form>
        </div>
      </div>
    </div>
  )
}