app.post("/seed-fake-users", async (req, res) => {
  const { latitude, longitude } = req.body
  const fakeUsers = [
    {
      id: "fake_user_1", name: "Mati 🎸",
      track: {
        name: "Corazón Delator", artist: "Soda Stereo",
        albumArt: "https://i.scdn.co/image/ab67616d0000b2737f4e0ce6c495e2a7c86aed4b",
        id: "4go2cRf8q2t8PQZjKn93xK",
        uri: "spotify:track:4go2cRf8q2t8PQZjKn93xK",
        progressMs: 45000
      }
    },
    {
      id: "fake_user_2", name: "Juli 🎧",
      track: {
        name: "Mariposa Technicolor", artist: "Fito Páez",
        albumArt: "https://i.scdn.co/image/ab67616d0000b273e5b6c1c1b1e4e4e4e4e4e4e4",
        id: "5Z01UMMf7V1o0MzF86s6WJ",
        uri: "spotify:track:5Z01UMMf7V1o0MzF86s6WJ",
        progressMs: 120000
      }
    },
    {
      id: "fake_user_3", name: "Santi 🎵",
      track: {
        name: "Rezo por Vos", artist: "Charly García",
        albumArt: "https://i.scdn.co/image/ab67616d0000b273c1b1e4e4e4e4e4e4e4e4e4e4",
        id: "6dOzqs6o4DNzXs4jF2v1Yq",
        uri: "spotify:track:6dOzqs6o4DNzXs4jF2v1Yq",
        progressMs: 30000
      }
    },
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
      user_id: u.id, display_name: u.name, photo_url: null,
      latitude: latitude + o.lat, longitude: longitude + o.lon,
      track: u.track, last_seen: new Date()
    })
  }
  res.json({ success: true, seeded: fakeUsers.length })
})