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

app.get("/", (req, res) => {
  res.send("Clix backend running 🚀")
})

app.post("/spotify-token", async (req, res) => {
  const { code, code_verifier, redirect_uri } = req.body
  try {
    const response = await axios.post(
      "https://accounts.spotify.com/api/token",
      new URLSearchParams({
        client_id: CLIENT_ID,
        grant_type: "authorization_code",
        code,
        redirect_uri,
        code_verifier
      }),
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    )
    res.json(response.data)
  } catch (error) {
    console.log("SPOTIFY TOKEN ERROR:", error.response?.data || error.message)
    res.status(500).json({ error: "Failed to exchange code", detail: error.response?.data })
  }
})

app.post("/upload-avatar", async (req, res) => {
  const { userId, imageBase64 } = req.body
  if (!userId || !imageBase64) {
    return res.status(400).json({ error: "Missing userId or imageBase64" })
  }
  try {
    const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, "")
    const buffer = Buffer.from(base64Data, "base64")
    const fileName = `${userId}.jpg`
    const { error } = await supabase.storage
      .from("avatars")
      .upload(fileName, buffer, {
        contentType: "image/jpeg",
        upsert: true,
      })
    if (error) {
      console.log("STORAGE ERROR:", error)
      return res.status(500).json({ error: error.message })
    }
    const { data } = supabase.storage.from("avatars").getPublicUrl(fileName)
    res.json({ url: data.publicUrl })
  } catch (err) {
    console.log("UPLOAD ERROR:", err)
    res.status(500).json({ error: err.message })
  }
})

app.post("/update-profile", async (req, res) => {
  const { userId, username, photoUrl } = req.body
  const { error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, username, photo_url: photoUrl, updated_at: new Date() })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

app.get("/profile/:userId", async (req, res) => {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("user_id", req.params.userId)
    .single()
  if (error || !data) return res.status(404).json({ error: "User not found" })
  res.json({ username: data.username, photoUrl: data.photo_url })
})

app.post("/update-location", async (req, res) => {
  const { userId, displayName, photoUrl, latitude, longitude, track } = req.body
  const { error } = await supabase
    .from("user_locations")
    .upsert({
      user_id: userId,
      display_name: displayName,
      photo_url: photoUrl,
      latitude,
      longitude,
      track,
      last_seen: new Date()
    })
  if (error) return res.status(500).json({ error: error.message })
  res.json({ success: true })
})

function distance(lat1, lon1, lat2, lon2) {
  const R = 6371e3
  const φ1 = lat1 * Math.PI / 180
  const φ2 = lat2 * Math.PI / 180
  const Δφ = (lat2 - lat1) * Math.PI / 180
  const Δλ = (lon2 - lon1) * Math.PI / 180
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

app.get("/nearby-users", async (req, res) => {
  const { latitude, longitude, userId } = req.query
  const lat = parseFloat(latitude)
  const lon = parseFloat(longitude)
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
  const { data, error } = await supabase
    .from("user_locations")
    .select("*")
    .neq("user_id", userId)
    .gte("last_seen", tenMinutesAgo)
  if (error) return res.status(500).json({ error: error.message })
  const nearby = data.filter(user => {
    const d = distance(lat, lon, user.latitude, user.longitude)
    return d <= 500
  })
  res.json(nearby.map(u => ({
    userId: u.user_id,
    displayName: u.display_name,
    photoUrl: u.photo_url,
    track: u.track,
    lastSeen: u.last_seen
  })))
})

const PORT = process.env.PORT || 3000
app.listen(PORT, () => console.log("Server running on port", PORT))
