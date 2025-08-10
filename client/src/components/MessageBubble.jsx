export default function MessageBubble({ me, text }){
  return <div className={`msg ${me? 'me':'them'}`}>{text}</div>
}