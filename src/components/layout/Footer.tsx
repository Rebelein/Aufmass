const Footer = () => {
  return (
    <footer className="bg-secondary text-secondary-foreground py-6 mt-auto">
      <div className="container mx-auto px-4 text-center">
        <p className="text-sm font-body">&copy; {new Date().getFullYear()} Rebelein Aufmaß. Alle Rechte vorbehalten.</p>
      </div>
    </footer>
  );
};

export default Footer;
