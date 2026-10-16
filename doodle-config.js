// Supabase project that stores submitted doodles.
// The anon/publishable key is meant to be public: the database rules in
// doodles-setup.sql only let visitors upload new doodles and read approved ones.
window.DOODLE_DB = {
  url: "",  // e.g. https://abcdefghijkl.supabase.co
  key: ""   // the project's anon / publishable key
};
