package game.player;

public enum Role {
  FIGHTER("Fighter"),
  HEALER("Healer");
  
  private String name;
  
  public Role(String name) { }
  
  @Override
  public String toString() {}
}

