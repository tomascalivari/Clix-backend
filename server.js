app.post("/seed-fake-users", async (req, res) => {
  const { latitude, longitude } = req.body
  const fakeUsers = [
    {
      id: "fake_user_1", name: "Mati 🎸",
      track: {
        name: "Corazón Delator", artist: "Gustavo Cerati",
        albumArt: "https://i.scdn.co/image/ab67616d0000b273c4f4a9b5d1c1b1e4e4e4e4e4",
        id: "2374M0fQpWi3dLnB54qaLX",
        uri: "spotify:track:2374M0fQpWi3dLnB54qaLX",
        progressMs: 45000
      }
    },
    {
      id: "fake_user_2", name: "Juli 🎧",
      track: {
        name: "Mariposa Technicolor", artist: "Fito Páez",
        albumArt: "https://i.scdn.co/image/ab67616d0000b273c4f4a9b5d1c1b1e4e4e4e4e4",
        id: "5Z01UMMf7V1o0MzF86s6WJ",
        uri: "spotify:track:5Z01UMMf7V1o0MzF86s6WJ",
        progressMs: 120000
      }
    },
    {
      id: "fake_user_3", name: "Santi 🎵",
      track: {
        name: "Charly 313", artist: "Charly García",
        albumArt: "https://i.scdn.co/image/ab67616d0000b273c4f4a9b5d1c1b1e4e4e4e4e4",
        id: "3YBMS3HNEbDNIjQdMLKCOR",
        uri: "spotify:track:3YBMS3HNEbDNIjQdMLKCOR",
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