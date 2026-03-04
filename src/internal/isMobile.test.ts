import { isMobile } from "./isMobile";

describe("isMobile", () => {
  const originalNavigator = global.navigator;

  afterEach(() => {
    // Restore original values
    Object.defineProperty(global, "navigator", {
      value: originalNavigator,
      writable: true,
      configurable: true,
    });
  });

  describe("Environment checks", () => {
    it("should return false when navigator is undefined", () => {
      Object.defineProperty(global, "navigator", {
        value: undefined,
        writable: true,
        configurable: true,
      });
      expect(isMobile()).toBe(false);
    });
  });

  describe("User agent detection", () => {
    const testUserAgent = (userAgent: string, expected: boolean) => {
      Object.defineProperty(global.navigator, "userAgent", {
        value: userAgent,
        writable: true,
        configurable: true,
      });
      expect(isMobile()).toBe(expected);
    };

    it("should detect Android devices", () => {
      testUserAgent("Mozilla/5.0 (Linux; Android 11) AppleWebKit/537.36", true);
    });

    it("should detect iPhone devices", () => {
      testUserAgent("Mozilla/5.0 (iPhone; CPU iPhone OS 14_0 like Mac OS X)", true);
    });

    it("should detect iPad devices", () => {
      testUserAgent("Mozilla/5.0 (iPad; CPU OS 14_0 like Mac OS X)", true);
    });

    it("should detect iPod devices", () => {
      testUserAgent("Mozilla/5.0 (iPod touch; CPU iPhone OS 14_0 like Mac OS X)", true);
    });

    it("should detect BlackBerry devices", () => {
      testUserAgent("Mozilla/5.0 (BlackBerry; U; BlackBerry 9900)", true);
    });

    it("should detect IEMobile devices", () => {
      testUserAgent("Mozilla/5.0 (compatible; MSIE 10.0; Windows Phone 8.0; IEMobile/10.0)", true);
    });

    it("should detect Opera Mini", () => {
      testUserAgent("Opera/9.80 (J2ME/MIDP; Opera Mini/9.80)", true);
    });

    it("should detect WebOS devices", () => {
      testUserAgent("Mozilla/5.0 (webOS/1.4.0; U; en-US)", true);
    });

    it("should not detect desktop Chrome", () => {
      testUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/91.0", false);
    });

    it("should not detect desktop Firefox", () => {
      testUserAgent("Mozilla/5.0 (X11; Linux x86_64; rv:89.0) Gecko/20100101 Firefox/89.0", false);
    });

    it("should not detect desktop Safari", () => {
      testUserAgent("Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 Safari/605.1.15", false);
    });

    it("should be case-insensitive for Android", () => {
      testUserAgent("Mozilla/5.0 (Linux; ANDROID 11) AppleWebKit/537.36", true);
    });

    it("should be case-insensitive for iPhone", () => {
      testUserAgent("Mozilla/5.0 (IPHONE; CPU iPhone OS 14_0)", true);
    });
  });

  describe("Vendor property fallback", () => {
    it("should check navigator.vendor if userAgent is empty", () => {
      Object.defineProperty(global.navigator, "userAgent", {
        value: "",
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global.navigator, "vendor", {
        value: "Android",
        writable: true,
        configurable: true,
      });
      expect(isMobile()).toBe(true);
    });
  });

  describe("Opera fallback", () => {
    it("should check window.opera if other properties are empty", () => {
      Object.defineProperty(global.navigator, "userAgent", {
        value: "",
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global.navigator, "vendor", {
        value: "",
        writable: true,
        configurable: true,
      });
      (global.window as any).opera = "opera mini";
      expect(isMobile()).toBe(true);
    });

    it("should return false if all properties indicate desktop", () => {
      Object.defineProperty(global.navigator, "userAgent", {
        value: "Mozilla/5.0 (Windows NT 10.0)",
        writable: true,
        configurable: true,
      });
      Object.defineProperty(global.navigator, "vendor", {
        value: "Google Inc.",
        writable: true,
        configurable: true,
      });
      (global.window as any).opera = undefined;
      expect(isMobile()).toBe(false);
    });
  });
});
