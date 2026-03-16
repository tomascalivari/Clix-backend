const express = require("express")
const axios = require("axios")
const cors = require("cors")
const { createClient } = require("@supabase/supabase-js")

const app = express()
app.use(cors())
app.use(express.json({ limit: "10mb" }))
app.use(express.urlencoded({ extended: true, limit: "10mb" }))

const CLIENT_ID = "ba5d89ce58e84d6da913444a41858f82"

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
)

app.get("/", (req, res) => res.send("Clix backend running 🚀"))

// SPOTIFY TOKEN EXCHANGE
app.post("/spotify-token", async (req, res) => {
  const { code, code_verifier, redirect_uri } = req.body
  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({ client_id: CLIENT_ID, grant_type: "authorization_code", code, redirect_uri, code_verifier }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    )
    res.json(response.data)
  } catch (error) {
    console.log("SPOTIFY TOKEN ERROR:", error.response?.data || error.message)
    res.status(500).json({ error: "Failed to exchange code", detail: error.response?.data })
  }
})

// UPLOAD AVATAR
app.post("/upload-avatar", async (req, res) => {
  const { userId, imageBase64 } = req.body
  if (!userId || !imageBase64) return res.status(400).json({ error: "Missing userId or imageBase64" })
  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")
    const fileName = `${userId}.jpg`
    const { error } = await supabase.storage.from("avatars").upload(fileName, buffer, { contentType: "image/jpeg", upsert: true })
    if (error) return res.status(500).json({ error: error.message })
    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName)
    res.json({ url: data.publicUrl })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// PERFIL
app.post("/update-profile", async (req, res) => {
  const { userId, username, photoUrl } = req.body
  const { error } = await supabase.from("profiles").upsert({ user_id: userId, username, photo_url: photoUrl, updated_at: new Date() })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

app.get("/profile/:userId", async (req, res) => {
  const { data, error } = await supabase.from("profiles").select("*").eq("user_id", req.params.userId).single()
  if (error || !data) return res.status(404).json({ error: "User not found" })
  res.json({ username: data.username, photoUrl: data.photo_url })
})

// UBICACIÓN
app.post("/update-location", async (req, res) => {
  const { userId, displayName, photoUrl, latitude, longitude, track } = req.body
  const { error } = await supabase.from("user_locations").upsert({
    user_id: userId, display_name: displayName, photo_url: photoUrl,
    latitude, longitude, track, last_seen: new Date()
  })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

function distance(lat1, lon1, lat2, lon2) {
  const R = 6371e3
  const φ1 = lat1 * Math.PI / 180, φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180, Δλ = (lon2 - lon1) * Math.PI / 180
  const a = Math.sin(Δφ/2)**2 + Math.cos(φ1)*Math.cos(φ2)*Math.sin(Δλ/2)**2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a))
}

app.get("/nearby-users", async (req, res) => {
  const { latitude, longitude, userId, radius = 80 } = req.query
  const lat = parseFloat(latitude), lon = parseFloat(longitude)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data, error } = await supabase.from("user_locations").select("*").neq("user_id", userId).gte("last_seen", tenMinutesAgo)
  if (error) return res.status(500).json({ error: error.message })
  const nearby = data.filter(u => distance(lat, lon, u.latitude, u.longitude) <= parseFloat(radius))
  res.json(nearby.map(u => ({
    userId: u.user_id, displayName: u.display_name, photoUrl: u.photo_url,
    track: u.track, lastSeen: u.last_seen,
    distance: Math.round(distance(lat, lon, u.latitude, u.longitude))
  })))
})

// CLIX (like)
app.post("/clix", async (req, res) => {
  const { fromUserId, toUserId, trackId, trackName, artistName, fromUsername, fromPhotoUrl } = req.body
  const { error } = await supabase.from("clixes").insert({
    from_user_id: fromUserId, to_user_id: toUserId,
    track_id: trackId, track_name: trackName, artist_name: artistName
  })
  if (error) return res.status(500).json({ error: error.message })
  await supabase.from("notifications").insert({
    to_user_id: toUserId, from_user_id: fromUserId,
    from_username: fromUsername, from_photo_url: fromPhotoUrl,
    type: "clix", track_name: trackName, artist_name: artistName
  })
  res.json({ success: true })
})

// JOIN (sumarse a canción o reproducción)
app.post("/join", async (req, res) => {
  const { fromUserId, toUserId, trackId, trackName, artistName, joinType, fromUsername, fromPhotoUrl } = req.body
  const { error } = await supabase.from("joins").insert({
    from_user_id: fromUserId, to_user_id: toUserId,
    track_id: trackId, track_name: trackName, artist_name: artistName,
    join_type: joinType
  })
  if (error) return res.status(500).json({ error: error.message })
  await supabase.from("notifications").insert({
    to_user_id: toUserId, from_user_id: fromUserId,
    from_username: fromUsername, from_photo_url: fromPhotoUrl,
    type: joinType === "track" ? "join_track" : "join_queue",
    track_name: trackName, artist_name: artistName
  })
  res.json({ success: true })
})

// NOTIFICACIONES
app.get("/notifications/:userId", async (req, res) => {
  const { data, error } = await supabase.from("notifications")
    .select("*").eq("to_user_id", req.params.userId)
    .order("created_at", { ascending: false }).limit(50)
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

app.post("/notifications/read", async (req, res) => {
  const { userId } = req.body
  const { error } = await supabase.from("notifications").update({ read: true }).eq("to_user_id", userId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

// SOLICITUDES DE MENSAJE
app.post("/message-request", async (req, res) => {
  const { fromUserId, toUserId, fromUsername, fromPhotoUrl } = req.body
  const { data: existing } = await supabase.from("message_requests")
    .select("*").eq("from_user_id", fromUserId).eq("to_user_id", toUserId).single()
  if (existing) return res.json({ success: true, existing: true })
  const { error } = await supabase.from("message_requests").insert({
    from_user_id: fromUserId, to_user_id: toUserId,
    from_username: fromUsername, from_photo_url: fromPhotoUrl
  })
  if (error) return res.status(500).json({ error: error.message })
  await supabase.from("notifications").insert({
    to_user_id: toUserId, from_user_id: fromUserId,
    from_username: fromUsername, from_photo_url: fromPhotoUrl,
    type: "message_request"
  })
  res.json({ success: true })
})

app.post("/message-request/respond", async (req, res) => {
  const { requestId, status } = req.body
  const { error } = await supabase.from("message_requests").update({ status }).eq("id", requestId)
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

app.get("/message-requests/:userId", async (req, res) => {
  const { data, error } = await supabase.from("message_requests")
    .select("*").eq("to_user_id", req.params.userId).eq("status", "pending")
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// MENSAJES
app.post("/message", async (req, res) => {
  const { conversationId, senderId, content } = req.body
  const { error } = await supabase.from("messages").insert({ conversation_id: conversationId, sender_id: senderId, content })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

app.get("/messages/:conversationId", async (req, res) => {
  const { data, error } = await supabase.from("messages")
    .select("*").eq("conversation_id", req.params.conversationId)
    .order("created_at", { ascending: true })
  if (error) return res.status(500).json({ error: error.message })
  res.json(data)
})

// USUARIOS SIMULADOS (solo para testing)
app.post("/seed-fake-users", async (req, res) => {
  const { latitude, longitude } = req.body
  const fakeUsers = [
    { id: "fake_user_1", name: "Mati 🎸", photo: null, track: { name: "La Llorona", artist: "Gustavo Cerati", albumArt: null, id: "track_1", progressMs: 45000 } },
    { id: "fake_user_2", name: "Juli 🎧", photo: null, track: { name: "Mañana", artist: "Kevin Johansen", albumArt: null, id: "track_2", progressMs: 120000 } },
    { id: "fake_user_3", name: "Santi 🎵", photo: null, track: { name: "Mariposa Technicolor", artist: "Fito Páez", albumArt: null, id: "track_3", progressMs: 30000 } },
  ]
  const offsets = [
    { lat: 0.0003, lon: 0.0002 },
    { lat: -0.0002, lon: 0.0003 },
    { lat: 0.0001, lon: -0.0003 },
  ]
  for (let i = 0; i < fakeUsers.length; i++) {
    const u = fakeUsers[i]
    const o = offsets[i]
    await supabase.from("user_locations").upsert({
      user_id: u.id, display_name: u.name, photo_url: u.photo,
      latitude: latitude + o.lat, longitude: longitude + o.lon,
      track: u.track, last_seen: new Date()
    })
  }
  res.json({ success: true, seeded: fakeUsers.length })
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log("Server running on port", PORT))